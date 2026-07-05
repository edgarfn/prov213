import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { sendWelcomeEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/** GET /api/usuarios — Lista usuários da serventia ativa */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const membros = await db.membroServentia.findMany({
    where: { serventiaId: membro.serventiaId },
    include: {
      user: { select: { id: true, name: true, email: true, mustChangePassword: true, createdAt: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })

  return NextResponse.json({ membros })
}

/** POST /api/usuarios — Cria novo usuário com acesso à serventia ativa */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode criar usuários' }, { status: 403 })
  }

  const body = (await req.json()) as {
    name?: string
    email?: string
    papel?: string
    serventiaId?: string
  }

  if (!body.name || !body.email || !body.papel) {
    return NextResponse.json({ error: 'Nome, e-mail e papel são obrigatórios' }, { status: 400 })
  }

  const papeis = ['TITULAR', 'RESPONSAVEL_TECNICO', 'DPO', 'COLABORADOR', 'AUDITOR_LEITURA', 'GESTOR_REGIONAL']
  if (!papeis.includes(body.papel)) {
    return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
  }

  const serventiaId = body.serventiaId ?? membro.serventiaId

  // Verifica que o serventiaId é gerenciado pelo usuário atual
  const serventiaValida = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId: session.user.id, serventiaId } },
  })
  if (!serventiaValida) {
    return NextResponse.json({ error: 'Serventia inválida' }, { status: 403 })
  }

  const emailNorm = body.email.toLowerCase().trim()
  let user = await db.user.findUnique({ where: { email: emailNorm } })
  const tempPassword = `Prov213@${randomBytes(4).toString('hex').toUpperCase()}`

  if (!user) {
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    user = await db.user.create({
      data: { name: body.name, email: emailNorm, passwordHash, mustChangePassword: true },
    })
  }

  // Verifica se já tem acesso
  const existing = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId: user.id, serventiaId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Usuário já tem acesso a esta serventia' }, { status: 409 })
  }

  await db.membroServentia.create({
    data: { userId: user.id, serventiaId, papel: body.papel as never, ativo: true },
  })

  // Envia e-mail de boas-vindas (ou loga no console). Falha aqui não desfaz
  // a criação do usuário — a senha provisória continua válida, só o e-mail
  // de aviso não chegou (o Titular pode repassar as credenciais manualmente).
  await sendWelcomeEmail(emailNorm, tempPassword).catch(async (err) => {
    const log = await getLogger({ userId: session.user.id, serventiaId, action: 'criar_usuario' })
    log.warn({ err, novoUsuarioId: user.id }, 'Falha ao enviar e-mail de boas-vindas')
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'USUARIO_CRIADO',
    entidade: 'User',
    entidadeId: user.id,
    valorNovo: { email: emailNorm, nome: body.name, papel: body.papel },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true, userId: user.id }, { status: 201 })
}
