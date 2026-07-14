import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * GET /api/recomendacoes/[id]/timeline — histórico de ações da recomendação
 * técnica, reaproveitando o AuditLog já registrado por
 * app/actions/recomendacao-tecnica.ts. Não gera um novo evento de auditoria.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) {
    return NextResponse.json({ error: 'Sem serventia ativa' }, { status: 403 })
  }

  const { id } = await params

  try {
    const recomendacao = await db.recomendacaoTecnica.findFirst({ where: { id, serventiaId: membro.serventiaId } })
    if (!recomendacao) {
      return NextResponse.json({ error: 'Recomendação não encontrada' }, { status: 404 })
    }

    const entradas = await db.auditLog.findMany({
      where: { serventiaId: membro.serventiaId, entidade: 'RecomendacaoTecnica', entidadeId: id },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: {
        id: true,
        acao: true,
        userEmail: true,
        userName: true,
        valorAnterior: true,
        valorNovo: true,
        timestamp: true,
      },
    })

    return NextResponse.json({ entradas })
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'timeline_recomendacao_tecnica' })
    log.error({ err, recomendacaoId: id }, 'Falha inesperada ao consultar timeline de recomendação técnica')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
