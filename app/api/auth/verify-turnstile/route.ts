import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstileToken } from '@/lib/turnstile'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { token } = (await req.json()) as { token?: string }

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, error: 'token_missing' }, { status: 400 })
  }

  const ip = req.headers.get('CF-Connecting-IP') ??
             req.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
             'unknown'

  const success = await verifyTurnstileToken(token, ip)
  if (!success) {
    return NextResponse.json({ success: false }, { status: 422 })
  }

  return NextResponse.json({ success: true })
}
