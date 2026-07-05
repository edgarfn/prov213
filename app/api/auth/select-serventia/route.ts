import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireServentiaMembro, SERVENTIA_COOKIE } from '@/lib/serventia-context'

export const runtime = 'nodejs'

/**
 * POST /api/auth/select-serventia
 * Body: { serventiaId: string }
 *
 * Valida que o usuário tem membership ativa na serventia solicitada
 * e seta o cookie `prov213_serventia`. Sem autorização → 403.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { serventiaId?: string }
  if (!body.serventiaId || typeof body.serventiaId !== 'string') {
    return NextResponse.json({ error: 'serventiaId obrigatório' }, { status: 400 })
  }

  // Garante que o usuário realmente pertence a essa serventia
  const membro = await requireServentiaMembro(session.user.id, body.serventiaId)
  if (!membro) {
    return NextResponse.json(
      { error: 'Acesso negado a esta serventia' },
      { status: 403 },
    )
  }

  const res = NextResponse.json({
    success: true,
    serventia: {
      id: membro.serventia.id,
      nome: membro.serventia.nome,
      papel: membro.papel,
    },
  })

  // Cookie HttpOnly — inacessível ao JS do browser (XSS protection)
  res.cookies.set(SERVENTIA_COOKIE, body.serventiaId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    secure: process.env.NODE_ENV === 'production',
  })

  return res
}

/** DELETE /api/auth/select-serventia — limpa o contexto ativo */
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(SERVENTIA_COOKIE)
  return res
}
