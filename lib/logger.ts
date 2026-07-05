/**
 * Logger técnico estruturado (JSON) — Pino.
 *
 * Diferença em relação a lib/audit.ts: aquele é o log de auditoria de
 * NEGÓCIO (quem fez o quê, para o auditor externo — imutável, com cadeia
 * de hash própria). Este é o log TÉCNICO da aplicação (erros de infra,
 * falhas inesperadas, diagnóstico operacional), consumido por quem opera
 * o servidor via stdout (capturado pelo Docker/PM2).
 *
 * Por que Pino: JSON nativo de baixo overhead, redaction de campos
 * sensíveis embutida, e roda bem em Node.js (todas as rotas/actions deste
 * projeto já usam o runtime Node, não Edge).
 */
import pino from 'pino'
import { randomUUID } from 'crypto'
import { headers } from 'next/headers'

const isDev = process.env.NODE_ENV !== 'production'

// Caminhos conhecidos que nunca devem ser gravados em claro, mesmo que
// alguém passe um objeto sensível diretamente como binding de log. Isto é
// uma rede de segurança adicional — para objetos dinâmicos/arbitrários,
// use maskSensitive() abaixo antes de logar.
const REDACT_PATHS = [
  'password', '*.password',
  'passwordHash', '*.passwordHash',
  'token', '*.token',
  'turnstileToken', '*.turnstileToken',
  'mfaSecret', '*.mfaSecret',
  'secret', '*.secret',
  'passphrase', '*.passphrase',
  'sessionToken', '*.sessionToken',
  'resetToken', '*.resetToken',
  'req.headers.authorization',
  'req.headers.cookie',
]

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  base: { service: 'prov213' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  // pino só tenta carregar o worker de pino-pretty quando esta chave existe —
  // em produção o objeto de config nem referencia 'pino-pretty', então a
  // ausência do pacote no runtime de produção não quebra nada.
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
        },
      }
    : {}),
})

// ─── Data masking para objetos dinâmicos (defesa em profundidade) ────────────

// Propositalmente NÃO inclui "hash"/"key" isolados: campos como
// hashSha256/hashIntegridade são o núcleo probatório do dossiê e da cadeia
// de auditoria deste sistema — mascará-los destruiria a evidência que a
// norma exige manter verificável, sem proteger segredo nenhum.
const SENSITIVE_KEY_FRAGMENTS = [
  'password', 'passwordhash', 'mfasecret', 'token', 'resettoken',
  'senha', 'secret', 'passphrase', 'sessiontoken', 'authorization',
  'cookie', 'apikey', 'privatekey',
]

/**
 * Mascara recursivamente qualquer chave cujo nome combine com um fragmento
 * sensível (case-insensitive, substring). Use antes de logar objetos
 * dinâmicos (body de requisição, payload de formulário) cuja forma não é
 * conhecida estaticamente pelos REDACT_PATHS acima.
 */
export function maskSensitive<T>(data: T): T {
  if (data === null || data === undefined) return data
  if (Array.isArray(data)) return data.map((v) => maskSensitive(v)) as unknown as T
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY_FRAGMENTS.some((s) => k.toLowerCase().includes(s))
          ? '[REDACTED]'
          : maskSensitive(v),
      ]),
    ) as T
  }
  return data
}

// ─── Contexto de requisição (requestId, userId, serventiaId, action) ────────

export interface LogContext {
  userId?: string | null
  serventiaId?: string | null
  action?: string
  [key: string]: unknown
}

/**
 * Lê o x-request-id propagado por proxy.ts para a requisição atual. Fora do
 * escopo de uma requisição (ex.: listener global do pool de conexões em
 * lib/db.ts), gera um id avulso só para aquela linha de log.
 */
export async function getRequestId(): Promise<string> {
  try {
    const h = await headers()
    return h.get('x-request-id') ?? randomUUID()
  } catch {
    return randomUUID()
  }
}

/**
 * Logger filho vinculado ao contexto da requisição atual — cada linha
 * emitida carrega requestId + o contexto informado (userId, serventiaId,
 * action), sem precisar repeti-los em cada chamada de log.
 */
export async function getLogger(ctx: LogContext = {}): Promise<pino.Logger> {
  const requestId = await getRequestId()
  return logger.child({ requestId, ...ctx })
}

// ─── Execução instrumentada de operações críticas ────────────────────────────

type LoggedResult<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Executa `fn` e, em caso de exceção não esperada, loga em nível "error"
 * com contexto completo (requestId/userId/serventiaId/action) e devolve um
 * erro genérico — em vez de deixar a falha subir crua (sem log nenhum) até
 * o error boundary do Next.js, ou fazer cada Server Action reimplementar o
 * mesmo try/catch manualmente.
 */
export async function runLogged<T>(
  action: string,
  ctx: LogContext,
  fn: () => Promise<T>,
): Promise<LoggedResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (err) {
    const log = await getLogger({ ...ctx, action })
    log.error({ err }, `Falha inesperada em ${action}`)
    return { ok: false, error: 'Erro interno. Tente novamente em instantes.' }
  }
}
