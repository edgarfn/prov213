import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

/** DELETE /api/usuarios/[id] — Remove acesso do usuário à serventia ativa */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode remover usuários' }, { status: 403 })
  }

  const { id: userId } = await params

  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Não é possível remover seu próprio acesso' }, { status: 400 })
  }

  await db.membroServentia.update({
    where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
    data: { ativo: false },
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'USUARIO_REMOVIDO',
    entidade: 'MembroServentia',
    entidadeId: userId,
    ipAddress: _req.headers.get('x-forwarded-for')?.split(',')[0] ?? _req.headers.get('x-real-ip'),
    userAgent: _req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}

/** PATCH /api/usuarios/[id] — Altera papel do usuário na serventia */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode alterar papéis' }, { status: 403 })
  }

  const { id: userId } = await params
  const { papel } = (await req.json()) as { papel?: string }

  const papeis = ['RESPONSAVEL_TECNICO', 'DPO', 'COLABORADOR', 'AUDITOR_LEITURA', 'GESTOR_REGIONAL']
  if (!papel || !papeis.includes(papel)) {
    return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
  }

  await db.membroServentia.update({
    where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
    data: { papel: papel as never },
  })

  return NextResponse.json({ success: true })
}
