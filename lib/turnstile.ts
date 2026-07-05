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
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY não configurada')
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
      console.error('[Turnstile] siteverify HTTP error:', cfRes.status, await cfRes.text())
      return false
    }

    const data: TurnstileVerifyResponse = await cfRes.json()
    if (!data.success) {
      console.error(
        '[Turnstile] siteverify falhou:',
        JSON.stringify({ errorCodes: data['error-codes'], hostname: data.hostname }),
      )
      return false
    }

    return true
  } catch (err) {
    console.error('[Turnstile] Verification error:', err)
    return false
  }
}
