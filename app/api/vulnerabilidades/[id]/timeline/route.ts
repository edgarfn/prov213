import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'

export const runtime = 'nodejs'

/**
 * GET /api/vulnerabilidades/[id]/timeline — histórico de ações da vulnerabilidade,
 * reaproveitando o AuditLog já registrado por app/actions/vulnerabilidades.ts.
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
  const vulnerabilidade = await db.vulnerabilidade.findFirst({ where: { id, serventiaId: membro.serventiaId } })
  if (!vulnerabilidade) {
    return NextResponse.json({ error: 'Vulnerabilidade não encontrada' }, { status: 404 })
  }

  const entradas = await db.auditLog.findMany({
    where: { serventiaId: membro.serventiaId, entidade: 'Vulnerabilidade', entidadeId: id },
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
}
