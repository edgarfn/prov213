'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { generateSecret, generateURI, verifySync } from 'otplib'
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Prisma } from '@/app/generated/prisma/client'
import { verifyTurnstileToken } from '@/lib/turnstile'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

// Erros "esperados" da transação de auto-cadastro — usados só para abortar o
// $transaction com uma mensagem específica, nunca vazam além de registerUser.
class CadastroIndisponivelError extends Error {}
class EmailJaCadastradoError extends Error {}

const REGISTRO_MAX_TENTATIVAS = 3

export async function registerUser(formData: FormData) {
  const turnstileToken = formData.get('turnstileToken')
  if (!turnstileToken || typeof turnstileToken !== 'string') {
    return { error: 'Complete a verificação de segurança antes de continuar.' }
  }

  const headersList = await headers()
  const ip = headersList.get('CF-Connecting-IP') ??
             headersList.get('X-Forwarded-For')?.split(',')[0].trim() ??
             undefined
  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip)
  if (!turnstileOk) {
    return { error: 'Verificação de segurança falhou. Tente novamente.' }
  }

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

  // Autocadastro só é permitido no primeiro acesso: o primeiro usuário criado
  // vira super-admin e, a partir daí, a rota fica bloqueada. A checagem
  // "contar e depois criar" roda dentro de uma transação Serializable para
  // fechar a corrida entre duas requisições simultâneas: sob essa isolação,
  // se ambas leem o banco vazio ao mesmo tempo, o Postgres detecta o
  // conflito de escrita e aborta uma delas (erro P2034) em vez de deixar
  // as duas criarem um "primeiro admin" cada uma. Repetimos algumas vezes
  // porque abortar-e-repetir é o comportamento esperado do Serializable,
  // não uma falha real.
  for (let tentativa = 1; tentativa <= REGISTRO_MAX_TENTATIVAS; tentativa++) {
    try {
      await db.$transaction(async (tx) => {
        const userCount = await tx.user.count()
        if (userCount > 0) throw new CadastroIndisponivelError()

        const existing = await tx.user.findUnique({ where: { email } })
        if (existing) throw new EmailJaCadastradoError()

        const passwordHash = await bcrypt.hash(password, 12)
        await tx.user.create({ data: { name, email, passwordHash, isAdmin: true } })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      return { success: true }
    } catch (e: unknown) {
      if (e instanceof CadastroIndisponivelError) {
        return { error: 'Cadastro indisponível. Peça a um administrador que crie sua conta.' }
      }
      if (e instanceof EmailJaCadastradoError) {
        return { error: 'E-mail já cadastrado.' }
      }

      const isSerializationConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034'
      if (isSerializationConflict && tentativa < REGISTRO_MAX_TENTATIVAS) {
        continue
      }

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

  return { error: 'Erro ao criar conta. Tente novamente.' }
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
