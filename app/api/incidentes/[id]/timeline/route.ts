import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * GET /api/incidentes/[id]/timeline — histórico de ações do incidente,
 * reaproveitando o AuditLog já registrado por app/actions/incidentes.ts.
 * Não gera um novo evento de auditoria: é uma visão inline dentro do próprio
 * fluxo de tratamento do incidente, não uma consulta ao módulo de auditoria.
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
    const incidente = await db.incidente.findFirst({ where: { id, serventiaId: membro.serventiaId } })
    if (!incidente) {
      return NextResponse.json({ error: 'Incidente não encontrado' }, { status: 404 })
    }

    const entradas = await db.auditLog.findMany({
      where: { serventiaId: membro.serventiaId, entidade: 'Incidente', entidadeId: id },
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
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'timeline_incidente' })
    log.error({ err, incidenteId: id }, 'Falha inesperada ao consultar timeline de incidente')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
