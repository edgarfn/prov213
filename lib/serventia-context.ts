/**
 * Contexto multi-tenant — serventia ativa por usuário
 *
 * Estratégia: cookie HttpOnly `prov213_serventia`
 * - Lido em Server Components / Server Actions via cookies() do next/headers
 * - Escrito via POST /api/auth/select-serventia (valida membership antes de setar)
 * - Nunca confia apenas no cookie: sempre verifica membership no DB a cada op. sensível
 */
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { SERVENTIA_COOKIE } from '@/lib/constants'
export { SERVENTIA_COOKIE } from '@/lib/constants'

/** Lê o serventiaId do cookie; retorna null se não definido */
export async function getActiveServentiaId(): Promise<string | null> {
  const store = await cookies()
  return store.get(SERVENTIA_COOKIE)?.value ?? null
}

/**
 * Verifica se userId tem acesso ativo a serventiaId e retorna o membro.
 * Bloqueia também quando a própria serventia está inativa (ver
 * Serventia.ativa) — mesmo um membro com vínculo ativo não pode operar
 * numa serventia inativada. Reativação é feita fora deste caminho, via
 * alternarAtivaServentia (app/actions/serventia.ts).
 */
export async function requireServentiaMembro(userId: string, serventiaId: string) {
  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId } },
    include: { serventia: true },
  })
  if (!membro || !membro.ativo || !membro.serventia.ativa) return null
  return membro
}

/**
 * Lista todas as serventias (ativas e inativas) de um usuário — inclui as
 * inativas de propósito, para que a tela de seleção possa exibi-las e
 * oferecer reativação a um TITULAR.
 */
export async function listUserServentias(userId: string) {
  const membros = await db.membroServentia.findMany({
    where: { userId, ativo: true },
    include: {
      serventia: {
        select: {
          id: true,
          nome: true,
          cns: true,
          cnpj: true,
          municipio: true,
          uf: true,
          classe: true,
          subclasse: true,
          tipoSolucao: true,
          infra: true,
          dataVigenciaNorma: true,
          responsavelTecnico: true,
          controladorDados: true,
          dpo: true,
          onboardingConcluido: true,
          ativa: true,
        },
      },
    },
    orderBy: { serventia: { nome: 'asc' } },
  })
  return membros
}

/** Valida que o serventiaId no cookie pertence ao userId; retorna membro ou null */
export async function getValidatedMembro(userId: string) {
  const serventiaId = await getActiveServentiaId()
  if (!serventiaId) return null
  return requireServentiaMembro(userId, serventiaId)
}
