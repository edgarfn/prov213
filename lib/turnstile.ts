import { logger } from '@/lib/logger'

const CLOUDFLARE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

/**
 * Verifica um token do Cloudflare Turnstile direto com a API da Cloudflare.
 * Compartilhado entre /api/auth/verify-turnstile (checagem client-side, usada
 * no login) e qualquer Server Action que precise validar o mesmo token sem
 * dar um round-trip HTTP para si mesmo (ex.: registerUser).
 */
export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    // Dev fallback sem secret key configurada — nunca acontece em produção
    logger.warn('TURNSTILE_SECRET_KEY não configurada — verificação ignorada (esperado apenas em dev)')
    return true
  }

  try {
    const form = new URLSearchParams()
    form.append('secret', secretKey)
    form.append('response', token)
    if (ip) form.append('remoteip', ip)

    const cfRes = await fetch(CLOUDFLARE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    if (!cfRes.ok) {
      logger.error(
        { status: cfRes.status, body: await cfRes.text() },
        'Turnstile: siteverify retornou erro HTTP',
      )
      return false
    }

    const data: TurnstileVerifyResponse = await cfRes.json()
    if (!data.success) {
      logger.warn(
        { errorCodes: data['error-codes'], hostname: data.hostname },
        'Turnstile: siteverify falhou',
      )
      return false
    }

    return true
  } catch (err) {
    logger.error({ err }, 'Turnstile: erro ao verificar token')
    return false
  }
}
