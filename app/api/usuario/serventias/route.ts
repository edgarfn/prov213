import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listUserServentias } from '@/lib/serventia-context'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/** GET /api/usuario/serventias — lista todas as serventias ativas do usuário */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const membros = await listUserServentias(session.user.id)

    return NextResponse.json({
      serventias: membros.map((m) => ({
        papel: m.papel,
        serventia: m.serventia,
      })),
    })
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, action: 'listar_serventias_usuario' })
    log.error({ err }, 'Falha inesperada ao listar serventias do usuário')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
