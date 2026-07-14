import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import {
  gerarRecomendacaoTecnicaDossiePdf,
  type Etapa1Data,
  type Etapa2Data,
  type Etapa3Data,
  type DecisaoDetalhesData,
  type TermoCienciaData,
  type Etapa5Data,
  type Etapa6Data,
  type Etapa7Data,
  type Etapa8Data,
} from '@/lib/pdf-recomendacao-tecnica'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/** GET /api/recomendacoes/[id]/dossie — dossiê consolidado em PDF, com as seções já preenchidas até o momento */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params

  try {
    const r = await db.recomendacaoTecnica.findFirst({
      where: { id, serventiaId: membro.serventiaId },
      include: {
        responsavelTecnico: { select: { name: true, email: true } },
        parecerDpoUser: { select: { name: true, email: true } },
        decisaoControlador: { select: { name: true, email: true } },
        ordemEmitidaPor: { select: { name: true, email: true } },
        aceiteTecnico: { select: { name: true, email: true } },
        aceiteControlador: { select: { name: true, email: true } },
      },
    })
    if (!r) {
      return NextResponse.json({ error: 'Recomendação não encontrada' }, { status: 404 })
    }

    const pdfBytes = await gerarRecomendacaoTecnicaDossiePdf({
      codigo: r.codigo,
      serventiaNome: membro.serventia.nome,
      serventiaCns: membro.serventia.cns,
      status: r.status,
      prioridade: r.prioridade,
      classificacaoRiscoFinal: r.classificacaoRiscoFinal,
      dataIdentificacao: r.dataIdentificacao,
      prazoRecomendado: r.prazoRecomendado,
      responsavelTecnicoNome: r.responsavelTecnico.name ?? r.responsavelTecnico.email,
      recomendacao: r.recomendacao as unknown as Etapa1Data,
      analiseRisco: r.analiseRisco as unknown as Etapa2Data | null,
      envolveDadosPessoais: r.envolveDadosPessoais,
      parecerDpo: r.parecerDpo as unknown as Etapa3Data | null,
      parecerDpoNome: r.parecerDpoUser ? (r.parecerDpoUser.name ?? r.parecerDpoUser.email) : null,
      parecerDpoConcluidoEm: r.parecerDpoConcluidoEm,
      decisao: r.decisao,
      decisaoDetalhes: r.decisaoDetalhes as unknown as DecisaoDetalhesData | null,
      decisaoControladorNome: r.decisaoControlador ? (r.decisaoControlador.name ?? r.decisaoControlador.email) : null,
      dataDecisao: r.dataDecisao,
      valorAutorizado: r.valorAutorizado,
      prazoImplantacao: r.prazoImplantacao,
      termoCiencia: r.termoCiencia as unknown as TermoCienciaData | null,
      prazoReavaliacao: r.prazoReavaliacao,
      ordemImplementacao: r.ordemImplementacao as unknown as Etapa5Data | null,
      ordemEmitidaPorNome: r.ordemEmitidaPor ? (r.ordemEmitidaPor.name ?? r.ordemEmitidaPor.email) : null,
      ordemEmitidaEm: r.ordemEmitidaEm,
      execucao: r.execucao as unknown as Etapa6Data | null,
      dataExecucaoRealizada: r.dataExecucaoRealizada,
      aceite: r.aceite as unknown as Etapa7Data | null,
      aceiteResultado: r.aceiteResultado,
      aceiteTecnicoNome: r.aceiteTecnico ? (r.aceiteTecnico.name ?? r.aceiteTecnico.email) : null,
      aceiteControladorNome: r.aceiteControlador ? (r.aceiteControlador.name ?? r.aceiteControlador.email) : null,
      dataAceite: r.dataAceite,
      documentosAtualizados: r.documentosAtualizados as unknown as Etapa8Data | null,
      documentosAtualizadosEm: r.documentosAtualizadosEm,
    })

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: 'RECOMENDACAO_DOSSIE_GERADO',
      entidade: 'RecomendacaoTecnica',
      entidadeId: r.id,
      valorNovo: { codigo: r.codigo, status: r.status },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="dossie-${r.codigo}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'gerar_dossie_recomendacao' })
    log.error({ err, recomendacaoId: id }, 'Falha inesperada ao gerar dossiê de recomendação técnica')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
