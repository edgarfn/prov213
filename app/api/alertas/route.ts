import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getValidatedMembro } from '@/lib/serventia-context'
import { getAlertasServentia } from '@/lib/alertas'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/** GET /api/alertas — resumo de alertas de prazo da serventia ativa (para uso client-side, ex.: dropdown na sidebar) */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) return NextResponse.json({ error: 'Sem serventia ativa' }, { status: 403 })

  try {
    const resumo = await getAlertasServentia(membro.serventiaId)
    return NextResponse.json(resumo)
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'listar_alertas' })
    log.error({ err }, 'Falha inesperada ao montar resumo de alertas')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
