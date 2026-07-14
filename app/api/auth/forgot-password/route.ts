import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { addHours } from 'date-fns'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { email, turnstileToken } = (await req.json()) as { email?: string; turnstileToken?: string }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })
  }

  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return NextResponse.json({ error: 'Complete a verificação de segurança antes de continuar.' }, { status: 400 })
  }

  const ip = req.headers.get('CF-Connecting-IP') ??
             req.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
             undefined

  try {
    const turnstileOk = await verifyTurnstileToken(turnstileToken, ip)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Responde com sucesso mesmo se o e-mail não existir (evita user enumeration)
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Invalida tokens anteriores
    await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })

    const token = randomBytes(32).toString('hex')
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: addHours(new Date(), 1),
      },
    })

    try {
      await sendPasswordResetEmail(user.email, token)
    } catch (err) {
      // Falha de envio não deve derrubar a resposta (o token já foi criado e
      // segue válido) — mas precisa ficar visível para o suporte investigar
      // reclamações de "e-mail nunca chegou".
      const log = await getLogger({ userId: user.id, action: 'forgot_password' })
      log.error({ err }, 'Falha ao enviar e-mail de redefinição de senha')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const log = await getLogger({ action: 'forgot_password' })
    log.error({ err }, 'Falha inesperada ao processar solicitação de redefinição de senha')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
