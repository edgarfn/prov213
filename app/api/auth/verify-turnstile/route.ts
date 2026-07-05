import { NextRequest, NextResponse } from 'next/server'

const CLOUDFLARE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export const runtime = 'nodejs'

interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

export async function POST(req: NextRequest) {
  try {
    const { token } = (await req.json()) as { token?: string }

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'token_missing' }, { status: 400 })
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY
    if (!secretKey) {
      // Dev fallback sem secret key configurada — nunca acontece em produção
      console.warn('[Turnstile] TURNSTILE_SECRET_KEY não configurada')
      return NextResponse.json({ success: true, dev: true })
    }

    const ip = req.headers.get('CF-Connecting-IP') ??
               req.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
               'unknown'

    const form = new URLSearchParams()
    form.append('secret', secretKey)
    form.append('response', token)
    form.append('remoteip', ip)

    const cfRes = await fetch(CLOUDFLARE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    if (!cfRes.ok) {
      console.error('[Turnstile] siteverify HTTP error:', cfRes.status, await cfRes.text())
      return NextResponse.json({ success: false, error: 'cf_api_error' }, { status: 502 })
    }

    const data: TurnstileVerifyResponse = await cfRes.json()

    if (!data.success) {
      console.error(
        '[Turnstile] siteverify falhou:',
        JSON.stringify({ errorCodes: data['error-codes'], hostname: data.hostname }),
      )
      return NextResponse.json(
        { success: false, errorCodes: data['error-codes'] },
        { status: 422 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Turnstile] Verification error:', err)
    return NextResponse.json({ success: false, error: 'internal' }, { status: 500 })
  }
}
