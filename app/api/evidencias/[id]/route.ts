import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { evidenciaBloqueadaPorRetencao, dataLimiteRetencaoEvidencia, parametrosPorClasse } from '@/lib/business-rules'

export const runtime = 'nodejs'

async function resolveEvidencia(id: string) {
  return db.evidencia.findUnique({
    where: { id },
    include: {
      progressoRequisito: {
        select: {
          serventiaId: true,
          requisitoId: true,
          serventia: { select: { classe: true } },
        },
      },
      testeRestauracao: {
        select: {
          serventiaId: true,
          serventia: { select: { classe: true } },
        },
      },
    },
  })
}

/** Uma evidência sempre tem exatamente uma origem (CHECK constraint no banco). */
function resolveOrigem(ev: NonNullable<Awaited<ReturnType<typeof resolveEvidencia>>>) {
  if (ev.progressoRequisito) {
    return { serventiaId: ev.progressoRequisito.serventiaId, classe: ev.progressoRequisito.serventia.classe }
  }
  return { serventiaId: ev.testeRestauracao!.serventiaId, classe: ev.testeRestauracao!.serventia.classe }
}

/** PATCH /api/evidencias/[id] — Altera tipo ou nome de exibição (arquivo imutável) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const ev = await resolveEvidencia(id)
  if (!ev || ev.deletedAt) return NextResponse.json({ error: 'Evidência não encontrada' }, { status: 404 })
  const origem = resolveOrigem(ev)

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.serventiaId !== origem.serventiaId) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  if (membro.papel === 'AUDITOR_LEITURA') {
    return NextResponse.json({ error: 'Perfil de visualização não pode alterar evidências' }, { status: 403 })
  }

  const body = (await req.json()) as { tipo?: string; nomeArquivo?: string }

  const tiposValidos = ['DOCUMENTO', 'CONTRATO', 'PRINT', 'LOG', 'RELATORIO', 'ATA']
  if (body.tipo && !tiposValidos.includes(body.tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const anterior = { tipo: ev.tipo, nomeArquivo: ev.nomeArquivo }

  const atualizado = await db.evidencia.update({
    where: { id },
    data: {
      ...(body.tipo ? { tipo: body.tipo as never } : {}),
      ...(body.nomeArquivo?.trim() ? { nomeArquivo: body.nomeArquivo.trim() } : {}),
    },
  })

  await logAudit({
    serventiaId: origem.serventiaId,
    userId: session.user.id,
    acao: 'EVIDENCIA_UPLOAD',   // reutiliza ação de evidência; valorAnterior distingue
    entidade: 'Evidencia',
    entidadeId: id,
    valorAnterior: anterior,
    valorNovo: { tipo: atualizado.tipo, nomeArquivo: atualizado.nomeArquivo, operacao: 'ALTERACAO_METADADOS' },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true, evidencia: atualizado })
}

/** DELETE /api/evidencias/[id] — Soft-delete (arquivo e hash preservados — retenção 5 anos) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const ev = await resolveEvidencia(id)
  if (!ev || ev.deletedAt) return NextResponse.json({ error: 'Evidência não encontrada' }, { status: 404 })
  const origem = resolveOrigem(ev)

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || membro.serventiaId !== origem.serventiaId) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  if (!['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json(
      { error: 'Apenas Titular ou Responsável Técnico pode excluir evidências' },
      { status: 403 },
    )
  }

  const { retencaoAnos } = parametrosPorClasse(origem.classe)
  if (evidenciaBloqueadaPorRetencao(ev.uploadedAt, retencaoAnos)) {
    const dataLimite = dataLimiteRetencaoEvidencia(ev.uploadedAt, retencaoAnos)
    return NextResponse.json(
      {
        error: `Esta evidência está sob retenção obrigatória de ${retencaoAnos} anos (Art. 7º, IV) e só poderá ser excluída a partir de ${dataLimite.toLocaleDateString('pt-BR')}.`,
      },
      { status: 403 },
    )
  }

  // Soft-delete: o arquivo físico e o hash SHA-256 são mantidos
  // conforme retenção de 5 anos (Art. 7º, IV do Provimento CNJ 213/2026)
  await db.evidencia.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  await logAudit({
    serventiaId: origem.serventiaId,
    userId: session.user.id,
    acao: 'EVIDENCIA_EXCLUIDA',
    entidade: 'Evidencia',
    entidadeId: id,
    valorAnterior: {
      nomeArquivo: ev.nomeArquivo,
      tipo: ev.tipo,
      hashSha256: ev.hashSha256,
      tamanhoBytes: ev.tamanhoBytes,
      storagePath: ev.storagePath,
    },
    valorNovo: { motivo: 'exclusao_pelo_usuario', arquivoFisicoPreservado: true },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}
