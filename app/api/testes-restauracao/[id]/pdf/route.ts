import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { gerarAtaRestauracaoPdf } from '@/lib/pdf-ata-restauracao'

export const runtime = 'nodejs'

/** GET /api/testes-restauracao/[id]/pdf — Gera a Ata (Anexo V) em PDF */
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
  const teste = await db.testeRestauracao.findFirst({
    where: { id, serventiaId: membro.serventiaId },
    include: { evidencias: { where: { deletedAt: null }, orderBy: { uploadedAt: 'asc' } } },
  })
  if (!teste) {
    return NextResponse.json({ error: 'Teste de restauração não encontrado' }, { status: 404 })
  }

  const participantes = Array.isArray(teste.participantes)
    ? (teste.participantes as Array<{ nome: string; papel: string }>)
    : []

  const pdfBytes = await gerarAtaRestauracaoPdf({
    serventiaNome: membro.serventia.nome,
    serventiaCns: membro.serventia.cns,
    classe: membro.serventia.classe,
    dataTeste: teste.dataTeste,
    sistemasRestaurados: teste.sistemasRestaurados,
    rtoDefinido: teste.rtoDefinido,
    rtoAferido: teste.rtoAferido,
    rpoDefinido: teste.rpoDefinido,
    rpoAferido: teste.rpoAferido,
    conformidade: teste.conformidade,
    participantes,
    arquiteturaBackup: (teste.arquiteturaBackup as Record<string, unknown> | null) ?? null,
    medidasCorretivas: teste.medidasCorretivas,
    evidencias: teste.evidencias.map((e) => ({ nomeArquivo: e.nomeArquivo, hashSha256: e.hashSha256 })),
    responsavelServentia: membro.serventia.responsavelTecnico ?? session.user.name ?? session.user.email ?? '',
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'TESTE_RESTAURACAO_ATA_GERADA',
    entidade: 'TesteRestauracao',
    entidadeId: teste.id,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ata-restauracao-${teste.dataTeste.toISOString().slice(0, 10)}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store, no-cache',
    },
  })
}
