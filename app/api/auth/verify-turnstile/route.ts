import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string }

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, error: 'token_missing' }, { status: 400 })
  }

  const ip = req.headers.get('CF-Connecting-IP') ??
             req.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
             'unknown'

  try {
    const success = await verifyTurnstileToken(token, ip)
    if (!success) {
      return NextResponse.json({ success: false }, { status: 422 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const log = await getLogger({ action: 'verify_turnstile' })
    log.error({ err }, 'Falha inesperada ao verificar token Turnstile')
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
