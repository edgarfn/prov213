/**
 * Rate limiting para rotas sensíveis (login, redefinição de senha, cadastro)
 * e para o tráfego geral da aplicação (proteção contra DoS/flood).
 *
 * Backend: Redis (via REDIS_URL) quando configurado — necessário em
 * ambientes com mais de uma instância do app, já que cada processo Node não
 * enxerga o contador dos outros. Sem REDIS_URL (dev local, instância única),
 * cai automaticamente para um contador em memória no próprio processo.
 *
 * Semântica: "N tentativas por janela, depois bloqueio temporário" — não é
 * uma simples janela fixa (que permitiria rajadas na borda da janela).
 * Estourar o limite acende uma chave de bloqueio com TTL próprio
 * (`blockMs`), que precisa expirar por completo antes de novas tentativas
 * serem aceitas — é isso que dá o efeito de "bloqueio temporário" pedido
 * para a rota de login.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Redis from 'ioredis'
import { logger } from '@/lib/logger'

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export interface RateLimitRule {
  /** Nome curto do bucket — isola o contador desta regra do de outras rotas. */
  bucket: string
  /** Requisições permitidas dentro da janela antes do bloqueio. */
  limit: number
  /** Duração da janela de contagem, em ms. */
  windowMs: number
  /** Duração do bloqueio ao estourar o limite, em ms (padrão: windowMs). */
  blockMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  /** Timestamp (epoch ms) em que a janela ou o bloqueio atual termina. */
  resetAt: number
}

// Regras usadas pelo proxy.ts. Cada rota sensível tem seu próprio bucket —
// gastar a cota de "esqueci minha senha" não consome a de "login", por ex.
export const RATE_LIMIT_RULES = {
  // Proteção geral contra flood/DoS — aplicada a toda requisição não-estática.
  global: { bucket: 'global', limit: 100, windowMs: 60_000 },
  // Força bruta / credential stuffing no login.
  authLogin: { bucket: 'auth-login', limit: 3, windowMs: 15 * 60_000 },
  // Abuso do auto-cadastro do primeiro administrador.
  authRegister: { bucket: 'auth-register', limit: 3, windowMs: 15 * 60_000 },
  // Abuso do disparo de e-mail de redefinição de senha.
  authForgotPassword: { bucket: 'auth-forgot', limit: 3, windowMs: 15 * 60_000 },
  // Força bruta contra o token de redefinição de senha.
  authResetPassword: { bucket: 'auth-reset', limit: 3, windowMs: 15 * 60_000 },
  // /api/auth/change-password exige a senha atual para confirmar a troca —
  // é um oráculo de verificação de senha como o login, só que atrás de uma
  // sessão já autenticada (ex.: sessão sequestrada/compartilhada tentando
  // adivinhar a senha real do titular da conta). Limite um pouco mais
  // generoso que o de login puro, já que aqui um usuário legítimo também
  // pode errar a própria senha ocasionalmente.
  authChangePassword: { bucket: 'auth-change-password', limit: 5, windowMs: 15 * 60_000 },
} satisfies Record<string, RateLimitRule>

// KEYS[1] = chave de bloqueio, KEYS[2] = chave de contagem
// ARGV[1] = limit, ARGV[2] = windowMs, ARGV[3] = blockMs
// Retorna [allowed (0|1), limit, remaining, ttlMs restante da janela/bloqueio]
const RATE_LIMIT_LUA = `
local blockKey = KEYS[1]
local countKey = KEYS[2]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl and blockTtl > 0 then
  return {0, limit, 0, blockTtl}
end

local count = redis.call('INCR', countKey)
if count == 1 then
  redis.call('PEXPIRE', countKey, windowMs)
end

if count > limit then
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  redis.call('DEL', countKey)
  return {0, limit, 0, blockMs}
end

local ttl = redis.call('PTTL', countKey)
if ttl < 0 then
  ttl = windowMs
end
return {1, limit, limit - count, ttl}
`

type RedisWithRateLimit = Redis & {
  rateLimit(
    blockKey: string,
    countKey: string,
    limit: number,
    windowMs: number,
    blockMs: number,
  ): Promise<[number, number, number, number]>
}

// undefined = ainda não tentou conectar; null = REDIS_URL ausente ou conexão
// indisponível — nesses dois casos o fallback em memória assume o trabalho.
let redisClient: RedisWithRateLimit | null | undefined

function getRedisClient(): RedisWithRateLimit | null {
  if (redisClient !== undefined) return redisClient

  const url = process.env.REDIS_URL
  if (!url) {
    redisClient = null
    return null
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  }) as RedisWithRateLimit

  client.on('error', (err) => {
    logger.error({ err }, 'rate-limit: erro na conexão Redis — usando fallback em memória')
  })

  client.defineCommand('rateLimit', { numberOfKeys: 2, lua: RATE_LIMIT_LUA })

  redisClient = client
  return redisClient
}

// ─── Fallback em memória (dev local / instância única) ──────────────────────

interface MemoryEntry {
  count: number
  resetAt: number
  blockedUntil?: number
}

const memoryStore = new Map<string, MemoryEntry>()

// Evita crescimento ilimitado do Map com IPs que passaram uma única vez.
// unref() garante que este timer não impede o processo Node de encerrar.
if (process.env.NODE_ENV !== 'test') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of memoryStore) {
        if ((entry.blockedUntil ?? 0) < now && entry.resetAt < now) memoryStore.delete(key)
      }
    },
    5 * 60_000,
  ).unref()
}

function checkMemory(
  key: string,
  rule: { limit: number; windowMs: number; blockMs: number },
): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, limit: rule.limit, remaining: 0, resetAt: entry.blockedUntil }
  }

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + rule.windowMs })
    return { allowed: true, limit: rule.limit, remaining: rule.limit - 1, resetAt: now + rule.windowMs }
  }

  entry.count += 1
  if (entry.count > rule.limit) {
    entry.blockedUntil = now + rule.blockMs
    return { allowed: false, limit: rule.limit, remaining: 0, resetAt: entry.blockedUntil }
  }

  return {
    allowed: true,
    limit: rule.limit,
    remaining: rule.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/** Reseta o estado em memória — uso exclusivo dos testes. */
export function _resetMemoryStoreForTests(): void {
  memoryStore.clear()
}

// ─── API principal ───────────────────────────────────────────────────────────

/**
 * Verifica e consome uma unidade da cota de `rule` para `identifier`
 * (tipicamente o IP do cliente). Tenta Redis primeiro quando REDIS_URL está
 * configurada; qualquer falha de conexão/consulta degrada para o contador em
 * memória local em vez de deixar a rota sensível sem proteção alguma.
 */
export async function checkRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const blockMs = rule.blockMs ?? rule.windowMs
  const key = `${rule.bucket}:${identifier}`
  const redis = getRedisClient()

  if (redis) {
    try {
      const [allowedFlag, limit, remaining, ttlMs] = await redis.rateLimit(
        `rl:block:${key}`,
        `rl:count:${key}`,
        rule.limit,
        rule.windowMs,
        blockMs,
      )
      return {
        allowed: allowedFlag === 1,
        limit,
        remaining,
        resetAt: Date.now() + ttlMs,
      }
    } catch (err) {
      logger.error(
        { err, bucket: rule.bucket, identifier },
        'rate-limit: falha ao consultar Redis — aplicando fallback em memória',
      )
    }
  }

  return checkMemory(key, { limit: rule.limit, windowMs: rule.windowMs, blockMs })
}

function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
}

/** Headers padrão de rate limit — anexados tanto em respostas permitidas
 * (para o cliente recuar proativamente) quanto em respostas 429. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
  if (!result.allowed) {
    headers['Retry-After'] = String(retryAfterSeconds(result))
  }
  return headers
}

/** Monta a resposta HTTP 429 padrão (JSON + headers de rate limit). */
export function tooManyRequestsResponse(
  result: RateLimitResult,
  message = 'Muitas requisições. Tente novamente mais tarde.',
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code: 'RATE_LIMITED',
      retryAfterSeconds: retryAfterSeconds(result),
    },
    { status: 429, headers: rateLimitHeaders(result) },
  )
}
