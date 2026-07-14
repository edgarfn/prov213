import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listUserServentias, SERVENTIA_COOKIE } from '@/lib/serventia-context'
import { absoluteUrl } from '@/lib/utils'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * GET /api/auth/auto-select
 * Seta automaticamente a única serventia do usuário e redireciona ao dashboard.
 * Usado pelo AppLayout quando o usuário tem exatamente 1 serventia mas sem cookie.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  try {
    const membros = await listUserServentias(session.user.id)

    if (membros.length === 0) {
      return NextResponse.redirect(absoluteUrl('/onboarding'))
    }

    if (membros.length > 1) {
      return NextResponse.redirect(absoluteUrl('/selecionar-serventia'))
    }

    // Exatamente 1 serventia — auto-select
    const serventiaId = membros[0].serventiaId
    const res = NextResponse.redirect(absoluteUrl('/dashboard'))

    res.cookies.set(SERVENTIA_COOKIE, serventiaId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === 'production',
    })

    return res
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, action: 'auto_select_serventia' })
    log.error({ err }, 'Falha inesperada ao selecionar automaticamente a serventia')
    return NextResponse.redirect(absoluteUrl('/selecionar-serventia'))
  }
}
