import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const formato = searchParams.get('formato') ?? 'json' // 'json' ou 'csv'
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  const entradas = await db.auditLog.findMany({
    where: {
      serventiaId: membro.serventiaId,
      ...(dataInicio || dataFim ? {
        timestamp: {
          ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
          ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59Z') } : {}),
        },
      } : {}),
    },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true, acao: true, entidade: true, entidadeId: true,
      userId: true, userEmail: true, userName: true,
      valorAnterior: true, valorNovo: true,
      timestamp: true, ipAddress: true, hashIntegridade: true,
    },
  })

  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'EXPORTACAO_AUDITORIA',
    entidade: 'AuditLog',
    valorNovo: { formato, totalExportado: entradas.length, dataInicio, dataFim },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  if (formato === 'csv') {
    const header = 'id,timestamp,acao,entidade,entidadeId,userId,userEmail,userName,ipAddress,hashIntegridade'
    const rows = entradas.map((e) =>
      [
        e.id, e.timestamp.toISOString(), e.acao, e.entidade,
        e.entidadeId ?? '', e.userId ?? '', e.userEmail ?? '',
        e.userName ?? '', e.ipAddress ?? '', e.hashIntegridade ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header, ...rows].join('\n')
    const filename = `auditoria_${membro.serventia.cns}_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const filename = `auditoria_${membro.serventia.cns}_${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify({ exportadoEm: new Date(), entradas }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
