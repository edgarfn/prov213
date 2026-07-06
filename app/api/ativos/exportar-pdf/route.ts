import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { gerarInventarioAtivosPdf, type AtivoInventarioItem } from '@/lib/pdf-inventario-ativos'

export const runtime = 'nodejs'

/**
 * GET /api/ativos/exportar-pdf — Inventário Completo de Ativos Tecnológicos
 * em PDF (evidência do Requisito 1.7). Exporta sempre o cadastro completo da
 * serventia (não respeita filtros da tela), pois o documento precisa
 * representar o inventário integral, não um recorte.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) return NextResponse.json({ error: 'Sem serventia ativa' }, { status: 403 })

  const serventia = membro.serventia
  const geradoEm = new Date()

  const ativos = await db.ativo.findMany({
    where: { serventiaId: serventia.id },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    include: { responsavel: { select: { name: true, email: true } } },
  })

  const itens: AtivoInventarioItem[] = ativos.map((a) => ({
    nome: a.nome,
    tipo: a.tipo,
    criticidade: a.criticidade,
    status: a.status,
    fabricante: a.fabricante,
    modelo: a.modelo,
    numeroSerie: a.numeroSerie,
    identificadorRede: a.identificadorRede,
    localizacao: a.localizacao,
    fornecedor: a.fornecedor,
    descricao: a.descricao,
    contemDadosPessoais: a.contemDadosPessoais,
    versaoAtual: a.versaoAtual,
    dataUltimaAtualizacao: a.dataUltimaAtualizacao,
    dataAquisicao: a.dataAquisicao,
    dataEntradaProducao: a.dataEntradaProducao,
    dataFimVidaUtil: a.dataFimVidaUtil,
    dataBaixa: a.dataBaixa,
    justificativaBaixa: a.justificativaBaixa,
    responsavelNome: a.responsavel ? (a.responsavel.name ?? a.responsavel.email) : null,
  }))

  const pdfBytes = await gerarInventarioAtivosPdf({
    serventiaNome: serventia.nome,
    serventiaCns: serventia.cns,
    classe: serventia.classe,
    municipio: serventia.municipio,
    uf: serventia.uf,
    itens,
    geradoEm,
    geradoPor: session.user.name ?? session.user.email ?? '',
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'RELATORIO_GERADO',
    entidade: 'Serventia',
    entidadeId: serventia.id,
    valorNovo: { tipo: 'INVENTARIO_ATIVOS', totalAtivos: itens.length },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inventario-ativos-${geradoEm.toISOString().slice(0, 10)}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}
