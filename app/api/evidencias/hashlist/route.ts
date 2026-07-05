import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { calcularHashMestre, gerarHashListPdf, type EvidenciaHashItem } from '@/lib/pdf-hashlist'

export const runtime = 'nodejs'

/**
 * GET /api/evidencias/hashlist — Exporta a lista de hashes assinável do
 * dossiê técnico (Anexo IV, Disposições Gerais, IV, "a"), exigida para as
 * Classes 2 e 3 e disponibilizada também à Classe 1 como boa prática.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Apenas Titular ou Responsável Técnico podem gerar a lista de hashes' }, { status: 403 })
  }

  const evidencias = await db.evidencia.findMany({
    where: { deletedAt: null, progressoRequisito: { serventiaId: membro.serventiaId } },
    orderBy: { uploadedAt: 'asc' },
    include: { progressoRequisito: { include: { requisito: { select: { codigo: true, titulo: true } } } } },
  })

  if (evidencias.length === 0) {
    return NextResponse.json({ error: 'Não há evidências anexadas para exportar' }, { status: 400 })
  }

  const uploaderIds = [...new Set(evidencias.map((e) => e.uploadedBy))]
  const uploaders = await db.user.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, name: true, email: true } })
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name ?? u.email]))

  const itens: EvidenciaHashItem[] = evidencias.map((e) => ({
    // Filtro da query (where: { progressoRequisito: { serventiaId } }) garante que
    // toda evidência retornada aqui tem progressoRequisito não-nulo.
    requisitoCodigo: e.progressoRequisito!.requisito.codigo,
    requisitoTitulo: e.progressoRequisito!.requisito.titulo,
    nomeArquivo: e.nomeArquivo,
    hashSha256: e.hashSha256,
    tamanhoBytes: e.tamanhoBytes,
    uploadedByNome: uploaderMap.get(e.uploadedBy) ?? e.uploadedBy,
    uploadedAt: e.uploadedAt,
  }))

  const hashMestre = calcularHashMestre(itens)
  const geradoEm = new Date()

  const pdfBytes = await gerarHashListPdf({
    serventiaNome: membro.serventia.nome,
    serventiaCns: membro.serventia.cns,
    classe: membro.serventia.classe,
    itens,
    hashMestre,
    responsavelNome: session.user.name ?? session.user.email ?? '',
    responsavelEmail: session.user.email ?? '',
    geradoEm,
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'DOSSIE_HASHLIST_EXPORTADO',
    entidade: 'Evidencia',
    valorNovo: { hashMestre, totalArquivos: itens.length },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="lista-hashes-dossie-${geradoEm.toISOString().slice(0, 10)}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}
