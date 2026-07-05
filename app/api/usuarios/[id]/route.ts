import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

/**
 * DELETE /api/usuarios/[id] — Exclui PERMANENTEMENTE o acesso do usuário a
 * esta serventia (remove a linha de MembroServentia). Diferente do antigo
 * comportamento (que só marcava ativo=false), isso é irreversível — por
 * isso é bloqueado sempre que houver dado associado ao usuário NESTA
 * serventia: histórico de auditoria, ou responsabilidade por progresso de
 * checklist, incidente ou vulnerabilidade. Para revogar o acesso mantendo
 * o histórico, use PATCH { ativo: false }.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode excluir usuários' }, { status: 403 })
  }

  const { id: userId } = await params

  if (userId === session.user.id) {
    return NextResponse.json({ error: 'Não é possível excluir seu próprio acesso' }, { status: 400 })
  }

  const alvo = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
    include: { user: { select: { email: true } } },
  })
  if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado nesta serventia' }, { status: 404 })
  if (alvo.papel === 'TITULAR') {
    return NextResponse.json({ error: 'Não é possível excluir o Titular' }, { status: 400 })
  }

  const [auditCount, progressoCount, incidenteCount, vulnerabilidadeCount] = await Promise.all([
    db.auditLog.count({ where: { userId, serventiaId: membro.serventiaId } }),
    db.progressoRequisito.count({ where: { serventiaId: membro.serventiaId, responsavelId: userId } }),
    db.incidente.count({ where: { serventiaId: membro.serventiaId, responsavelId: userId } }),
    db.vulnerabilidade.count({ where: { serventiaId: membro.serventiaId, responsavelId: userId } }),
  ])

  if (auditCount > 0 || progressoCount > 0 || incidenteCount > 0 || vulnerabilidadeCount > 0) {
    return NextResponse.json({
      error:
        'Não é possível excluir: este usuário possui histórico associado a esta serventia ' +
        '(auditoria, progresso de checklist, incidentes ou vulnerabilidades). ' +
        'Use "Desativar" para revogar o acesso mantendo o histórico.',
    }, { status: 409 })
  }

  await db.membroServentia.delete({
    where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'USUARIO_REMOVIDO',
    entidade: 'MembroServentia',
    entidadeId: userId,
    valorAnterior: { email: alvo.user.email, papel: alvo.papel },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}

/** PATCH /api/usuarios/[id] — Altera papel, ativo (revogar/reativar acesso) e/ou nome/e-mail */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode alterar usuários' }, { status: 403 })
  }

  const { id: userId } = await params
  const body = (await req.json()) as { papel?: string; ativo?: boolean; name?: string; email?: string }

  const alvo = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
  })
  if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado nesta serventia' }, { status: 404 })
  if (alvo.papel === 'TITULAR') {
    return NextResponse.json({ error: 'Não é possível alterar o Titular' }, { status: 400 })
  }

  if (body.papel !== undefined) {
    const papeis = ['RESPONSAVEL_TECNICO', 'DPO', 'COLABORADOR', 'AUDITOR_LEITURA', 'GESTOR_REGIONAL']
    if (!papeis.includes(body.papel)) {
      return NextResponse.json({ error: 'Papel inválido' }, { status: 400 })
    }

    await db.membroServentia.update({
      where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
      data: { papel: body.papel as never },
    })

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: 'PAPEL_ALTERADO',
      entidade: 'MembroServentia',
      entidadeId: userId,
      valorAnterior: { papel: alvo.papel },
      valorNovo: { papel: body.papel },
    })
  }

  if (body.ativo !== undefined) {
    if (userId === session.user.id && !body.ativo) {
      return NextResponse.json({ error: 'Não é possível desativar seu próprio acesso' }, { status: 400 })
    }

    await db.membroServentia.update({
      where: { userId_serventiaId: { userId, serventiaId: membro.serventiaId } },
      data: { ativo: body.ativo },
    })

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: body.ativo ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO',
      entidade: 'MembroServentia',
      entidadeId: userId,
    })
  }

  if (body.name !== undefined || body.email !== undefined) {
    const dataUser: { name?: string; email?: string } = {}

    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: 'Nome não pode ficar vazio' }, { status: 400 })
      dataUser.name = body.name.trim()
    }

    if (body.email !== undefined) {
      const emailNorm = body.email.toLowerCase().trim()
      if (!emailNorm) return NextResponse.json({ error: 'E-mail não pode ficar vazio' }, { status: 400 })

      const existing = await db.user.findUnique({ where: { email: emailNorm } })
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: 'Já existe uma conta com este e-mail' }, { status: 409 })
      }
      dataUser.email = emailNorm
    }

    const anterior = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })

    await db.user.update({ where: { id: userId }, data: dataUser })

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: 'USUARIO_ATUALIZADO',
      entidade: 'User',
      entidadeId: userId,
      valorAnterior: anterior ?? undefined,
      valorNovo: dataUser,
    })
  }

  return NextResponse.json({ success: true })
}
