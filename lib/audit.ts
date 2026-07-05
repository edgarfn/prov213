/**
 * Motor central de auditoria — Security by Design + Privacy by Design
 *
 * Princípios aplicados:
 *  • Imutabilidade:  trigger PostgreSQL (prevent_auditlog_mutation, migration
 *                    20260704_auditlog_immutability_trigger) impede UPDATE/DELETE
 *                    na tabela AuditLog a nível de banco
 *  • Cadeia de hash: SHA-256(prevHash + dados da entrada) detecta adulteração
 *  • Minimização:    campos sensíveis mascarados antes de persistir
 *  • Resiliência:    email/nome desnormalizados (auditável mesmo pós-exclusão de usuário)
 *  • Não-repúdio:   IP + User-Agent registrados para forense
 *  • Consistência:  função única garante o mesmo formato em todo o sistema
 */
import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { db } from '@/lib/db'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AcaoAuditoria =
  // Auth
  | 'LOGIN_SUCESSO'
  | 'LOGIN_FALHOU'
  | 'MFA_SUCESSO'
  | 'MFA_FALHOU'
  | 'LOGOUT'
  | 'SENHA_ALTERADA'
  | 'SENHA_RECUPERADA'
  | 'MFA_ATIVADO'
  | 'ACESSO_NEGADO'
  // Usuários
  | 'USUARIO_CRIADO'
  | 'USUARIO_REMOVIDO'
  | 'PAPEL_ALTERADO'
  // Serventias
  | 'SERVENTIA_CRIADA'
  | 'SERVENTIA_ATUALIZADA'
  // Progresso / Conformidade
  | 'PROGRESSO_ATUALIZADO'
  | 'ETAPA_DECLARADA'
  // Evidências
  | 'EVIDENCIA_UPLOAD'
  | 'EVIDENCIA_DOWNLOAD'
  | 'EVIDENCIA_EXCLUIDA'
  // Backup
  | 'BACKUP_CRIADO'
  | 'BACKUP_DOWNLOAD'
  | 'BACKUP_EXCLUIDO'
  | 'BACKUP_RESTAURADO'
  // Incidentes (Art. 11)
  | 'INCIDENTE_CRIADO'
  | 'INCIDENTE_ATUALIZADO'
  | 'INCIDENTE_COMUNICADO_CORREGEDORIA'
  | 'INCIDENTE_COMUNICADO_ANPD'
  | 'INCIDENTE_COMUNICADO_GERADO'
  | 'INCIDENTE_ENCERRADO'
  // Vulnerabilidades (Anexo II, item 5)
  | 'VULNERABILIDADE_CRIADA'
  | 'VULNERABILIDADE_ATUALIZADA'
  | 'VULNERABILIDADE_ENCERRADA'
  // Testes de restauração (Anexo V)
  | 'TESTE_RESTAURACAO_CRIADO'
  | 'TESTE_RESTAURACAO_ATA_GERADA'
  // Dossiê / Relatórios
  | 'DOSSIE_HASHLIST_EXPORTADO'
  | 'DOSSIE_PACOTE_EXPORTADO'
  | 'RELATORIO_GERADO'
  // Prorrogação de prazo (Art. 21)
  | 'PRORROGACAO_SOLICITADA'
  | 'PRORROGACAO_DECIDIDA'
  // Sistema
  | 'EXPORTACAO_AUDITORIA'

export interface AuditParams {
  serventiaId?: string | null
  userId?: string | null
  acao: AcaoAuditoria
  entidade: string
  entidadeId?: string | null
  valorAnterior?: Record<string, unknown> | null
  valorNovo?: Record<string, unknown> | null
  /** Passado explicitamente por API routes; em Server Actions usa next/headers */
  ipAddress?: string | null
  userAgent?: string | null
}

// ─── Campos sensíveis a mascarar (Privacy by Design) ─────────────────────────

const SENSITIVE_KEYS = [
  'password', 'passwordhash', 'mfasecret', 'token', 'resettoken',
  'senha', 'secret', 'hash', 'key', 'pass',
]

function maskSensitive(data: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!data) return null
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? '[REDACTED]' : v,
    ]),
  )
}

// ─── Captura de contexto HTTP (Server Actions) ────────────────────────────────

async function captureHttpContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const hdrs = await headers()
    const ip =
      hdrs.get('x-forwarded-for')?.split(',')[0].trim() ??
      hdrs.get('x-real-ip') ??
      null
    const ua = hdrs.get('user-agent') ?? null
    return { ipAddress: ip, userAgent: ua }
  } catch {
    return { ipAddress: null, userAgent: null }
  }
}

// ─── Cálculo do hash (cadeia de integridade) ──────────────────────────────────

const GENESIS_HASH = '0'.repeat(64) // hash da "entrada anterior" para o 1º registro

function computeHash(prevHash: string, entry: {
  timestamp: string
  userId?: string | null
  acao: string
  entidade: string
  valorNovo: unknown
}): string {
  const payload = JSON.stringify({
    prevHash,
    timestamp: entry.timestamp,
    userId: entry.userId ?? '',
    acao: entry.acao,
    entidade: entry.entidade,
    valorNovo: entry.valorNovo ?? null,
  })
  return createHash('sha256').update(payload).digest('hex')
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    // Contexto HTTP (falha silenciosa se não disponível)
    const httpCtx = await captureHttpContext()
    const ipAddress = params.ipAddress ?? httpCtx.ipAddress
    const userAgent = params.userAgent ?? httpCtx.userAgent

    // Dados do usuário para desnormalização (resiliente a exclusão futura)
    let userEmail: string | null = null
    let userName: string | null = null
    if (params.userId) {
      const user = await db.user.findUnique({
        where: { id: params.userId },
        select: { email: true, name: true },
      }).catch(() => null)
      userEmail = user?.email ?? null
      userName = user?.name ?? null
    }

    // Hash do último registro da serventia (ou global) para a cadeia
    const lastEntry = await db.auditLog.findFirst({
      where: params.serventiaId ? { serventiaId: params.serventiaId } : {},
      orderBy: { timestamp: 'desc' },
      select: { hashIntegridade: true },
    }).catch(() => null)

    const prevHash = lastEntry?.hashIntegridade ?? GENESIS_HASH
    const timestamp = new Date()

    const hashIntegridade = computeHash(prevHash, {
      timestamp: timestamp.toISOString(),
      userId: params.userId,
      acao: params.acao,
      entidade: params.entidade,
      valorNovo: params.valorNovo,
    })

    await db.auditLog.create({
      data: {
        serventiaId: params.serventiaId ?? undefined,
        userId: params.userId ?? undefined,
        userEmail,
        userName,
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId ?? undefined,
        valorAnterior: maskSensitive(params.valorAnterior) as never,
        valorNovo: maskSensitive(params.valorNovo) as never,
        timestamp,
        ipAddress,
        userAgent,
        hashIntegridade,
      },
    })
  } catch (err) {
    // Auditoria nunca bloqueia o fluxo principal — registra no stderr
    console.error('[AUDIT] Falha ao registrar evento:', params.acao, err)
  }
}

// ─── Verificação de integridade da cadeia ─────────────────────────────────────

export interface IntegrityResult {
  totalEntradas: number
  entradasVerificadas: number
  falhas: Array<{ id: string; timestamp: Date; acao: string }>
  integraPercent: number
}

export async function verificarIntegridade(serventiaId?: string): Promise<IntegrityResult> {
  const entries = await db.auditLog.findMany({
    where: serventiaId ? { serventiaId } : {},
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      timestamp: true,
      userId: true,
      acao: true,
      entidade: true,
      valorNovo: true,
      hashIntegridade: true,
    },
  })

  let prevHash = GENESIS_HASH
  const falhas: Array<{ id: string; timestamp: Date; acao: string }> = []

  for (const entry of entries) {
    const expected = computeHash(prevHash, {
      timestamp: entry.timestamp.toISOString(),
      userId: entry.userId,
      acao: entry.acao,
      entidade: entry.entidade,
      valorNovo: entry.valorNovo,
    })

    if (entry.hashIntegridade && entry.hashIntegridade !== expected) {
      falhas.push({ id: entry.id, timestamp: entry.timestamp, acao: entry.acao })
    }
    prevHash = entry.hashIntegridade ?? expected
  }

  const total = entries.length
  return {
    totalEntradas: total,
    entradasVerificadas: total - falhas.length,
    falhas,
    integraPercent: total > 0 ? Math.round(((total - falhas.length) / total) * 100) : 100,
  }
}
