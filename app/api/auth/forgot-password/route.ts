import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { addHours } from 'date-fns'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })
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

  await sendPasswordResetEmail(user.email, token)

  return NextResponse.json({ success: true })
}
