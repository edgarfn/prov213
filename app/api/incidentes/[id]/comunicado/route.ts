import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { prazoIncidenteCritico } from '@/lib/business-rules'
import { gerarComunicadoIncidentePdf, type DestinoComunicado } from '@/lib/pdf-comunicado-incidente'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/** GET /api/incidentes/[id]/comunicado?destino=CORREGEDORIA|ANPD — gera o PDF do comunicado */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const destino = req.nextUrl.searchParams.get('destino') as DestinoComunicado | null
  if (destino !== 'CORREGEDORIA' && destino !== 'ANPD') {
    return NextResponse.json({ error: 'Parâmetro "destino" inválido (use CORREGEDORIA ou ANPD)' }, { status: 400 })
  }

  const { id } = await params

  try {
    const incidente = await db.incidente.findFirst({ where: { id, serventiaId: membro.serventiaId } })
    if (!incidente) {
      return NextResponse.json({ error: 'Incidente não encontrado' }, { status: 404 })
    }

    const pdfBytes = await gerarComunicadoIncidentePdf({
      destino,
      serventiaNome: membro.serventia.nome,
      serventiaCns: membro.serventia.cns,
      classe: membro.serventia.classe,
      dpo: membro.serventia.dpo,
      controladorDados: membro.serventia.controladorDados,
      titulo: incidente.titulo,
      categoria: incidente.categoria,
      gravidade: incidente.gravidade,
      descricao: incidente.descricao,
      dataOcorrencia: incidente.dataOcorrencia,
      dataCiencia: incidente.dataCiencia,
      prazoLimite: incidente.gravidade === 'CRITICO' ? prazoIncidenteCritico(incidente.dataCiencia) : null,
      dataComunicacao: incidente.dataComunicacao,
      causaRaiz: incidente.causaRaiz,
      medidasCorretivas: incidente.medidasCorretivas,
      dadosPessoaisEnvolvidos: incidente.dadosPessoaisEnvolvidos,
      categoriasDadosAfetados: incidente.categoriasDadosAfetados,
      quantidadeTitularesAfetados: incidente.quantidadeTitularesAfetados,
      riscosTitulares: incidente.riscosTitulares,
      responsavelNome: membro.serventia.responsavelTecnico ?? session.user.name ?? session.user.email ?? '',
    })

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: 'INCIDENTE_COMUNICADO_GERADO',
      entidade: 'Incidente',
      entidadeId: incidente.id,
      valorNovo: { destino },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comunicado-incidente-${destino.toLowerCase()}-${incidente.id}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'gerar_comunicado_incidente' })
    log.error({ err, incidenteId: id, destino }, 'Falha inesperada ao gerar comunicado de incidente')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
