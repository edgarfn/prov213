'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { generateSecret, generateURI, verifySync } from 'otplib'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function registerUser(formData: FormData) {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Dados inválidos. Verifique os campos.' }
  }

  const { name, email, password } = parsed.data

  try {
    // Autocadastro só é permitido no primeiro acesso: o primeiro usuário
    // criado vira super-admin e, a partir daí, a rota fica bloqueada.
    const userCount = await db.user.count()
    if (userCount > 0) {
      return { error: 'Cadastro indisponível. Peça a um administrador que crie sua conta.' }
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return { error: 'E-mail já cadastrado.' }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await db.user.create({ data: { name, email, passwordHash, isAdmin: true } })

    return { success: true }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    // Log no servidor para diagnóstico — não expõe detalhes ao cliente
    console.error('[registerUser] Erro:', err.message)
    return {
      error:
        process.env.NODE_ENV === 'development'
          ? `Erro (dev): ${err.message}`
          : 'Erro ao criar conta. Tente novamente.',
    }
  }
}

export async function setupMFA() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const secret = generateSecret()
  const otpauthUrl = generateURI({
    issuer: 'Prov213 Compliance',
    label: session.user.email ?? 'usuario',
    secret,
  })

  await db.user.update({
    where: { id: session.user.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  })

  return { secret, otpauthUrl }
}

export async function verifyAndEnableMFA(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const code = formData.get('code') as string
  if (!code) return { error: 'Código obrigatório' }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.mfaSecret) return { error: 'Configuração de MFA não encontrada' }

  const result = verifySync({ token: code, secret: user.mfaSecret })
  if (!result?.valid) return { error: 'Código inválido. Tente novamente.' }

  await db.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: true, mfaVerified: true },
  })

  return { success: true }
}
