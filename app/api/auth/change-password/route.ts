import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { currentPassword, newPassword } = (await req.json()) as {
    currentPassword?: string
    newPassword?: string
  }

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Senha mínima de 8 caracteres' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.passwordHash) return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })

  if (!user.mustChangePassword && currentPassword) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) {
      await logAudit({
        userId: user.id,
        acao: 'ACESSO_NEGADO',
        entidade: 'User',
        entidadeId: user.id,
        valorNovo: { motivo: 'senha_atual_incorreta_na_troca' },
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })

  await logAudit({
    userId: user.id,
    acao: 'SENHA_ALTERADA',
    entidade: 'User',
    entidadeId: user.id,
    valorNovo: { primeiroAcesso: user.mustChangePassword },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}
