import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { gerarPacoteProbatorio } from '@/lib/pacote-probatorio'

export const runtime = 'nodejs'

/**
 * GET /api/relatorios/pacote-probatorio — Exporta o dossiê de evidências em
 * um único ZIP (índice + lista de hashes + arquivos), conforme spec 5.4.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Apenas Titular ou Responsável Técnico podem exportar o pacote probatório' }, { status: 403 })
  }

  let resultado
  try {
    resultado = await gerarPacoteProbatorio({
      serventiaId: membro.serventiaId,
      responsavelNome: session.user.name ?? session.user.email ?? '',
      responsavelEmail: session.user.email ?? '',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar o pacote probatório'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const geradoEm = new Date()

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'DOSSIE_PACOTE_EXPORTADO',
    entidade: 'Evidencia',
    valorNovo: { hashMestre: resultado.hashMestre, totalArquivos: resultado.totalArquivos },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(new Uint8Array(resultado.zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="pacote-probatorio-${geradoEm.toISOString().slice(0, 10)}.zip"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}
