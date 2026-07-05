import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listUserServentias } from '@/lib/serventia-context'

export const runtime = 'nodejs'

/** GET /api/usuario/serventias — lista todas as serventias ativas do usuário */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membros = await listUserServentias(session.user.id)

  return NextResponse.json({
    serventias: membros.map((m) => ({
      papel: m.papel,
      serventia: m.serventia,
    })),
  })
}
