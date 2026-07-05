import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { verifySync } from 'otplib'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        totpCode: { label: 'Código MFA', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()
        const user = await db.user.findUnique({ where: { email } })

        // Timing-safe — previne user enumeration por tempo de resposta
        const dummyHash = '$2b$12$dummy.hash.to.prevent.timing.attacks.xxxxxx'
        const hashToCompare = user?.passwordHash ?? dummyHash
        const passwordOk = await bcrypt.compare(credentials.password, hashToCompare)

        if (!user || !passwordOk) {
          await logAudit({
            userId: user?.id,
            acao: 'LOGIN_FALHOU',
            entidade: 'User',
            entidadeId: user?.id,
            valorNovo: { email, motivo: !user ? 'usuario_nao_encontrado' : 'senha_incorreta' },
          })
          return null
        }

        if (user.mfaEnabled && user.mfaVerified) {
          if (!credentials.totpCode) throw new Error('MFA_REQUIRED')

          if (!user.mfaSecret) {
            await logAudit({ userId: user.id, acao: 'LOGIN_FALHOU', entidade: 'User', entidadeId: user.id, valorNovo: { email, motivo: 'mfa_sem_segredo' } })
            return null
          }

          const valid = verifySync({ token: credentials.totpCode, secret: user.mfaSecret })
          if (!valid?.valid) {
            await logAudit({ userId: user.id, acao: 'MFA_FALHOU', entidade: 'User', entidadeId: user.id, valorNovo: { email, motivo: 'codigo_invalido' } })
            throw new Error('MFA_INVALID')
          }

          await logAudit({ userId: user.id, acao: 'MFA_SUCESSO', entidade: 'User', entidadeId: user.id })
        }

        await logAudit({
          userId: user.id,
          acao: 'LOGIN_SUCESSO',
          entidade: 'User',
          entidadeId: user.id,
          valorNovo: { email, mfaUsado: user.mfaEnabled && user.mfaVerified },
        })

        return { id: user.id, email: user.email, name: user.name ?? undefined, mfaEnabled: user.mfaEnabled, mfaVerified: user.mfaVerified }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.mfaEnabled = (user as { mfaEnabled?: boolean }).mfaEnabled ?? false
        token.mfaVerified = (user as { mfaVerified?: boolean }).mfaVerified ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session as any).mfaEnabled = token.mfaEnabled
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session as any).mfaVerified = token.mfaVerified
      }
      return session
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await logAudit({ userId: token.id as string, acao: 'LOGOUT', entidade: 'User', entidadeId: token.id as string })
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
