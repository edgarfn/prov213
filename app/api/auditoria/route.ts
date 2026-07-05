import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) return NextResponse.json({ error: 'Sem serventia ativa' }, { status: 403 })

  // Apenas TITULAR, RESPONSAVEL_TECNICO e AUDITOR_LEITURA podem consultar logs
  const papeisPermitidos = ['TITULAR', 'RESPONSAVEL_TECNICO', 'AUDITOR_LEITURA', 'GESTOR_REGIONAL']
  if (!papeisPermitidos.includes(membro.papel)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const acao = searchParams.get('acao') ?? undefined
  const userId = searchParams.get('userId') ?? undefined
  const entidade = searchParams.get('entidade') ?? undefined
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const where = {
    serventiaId: membro.serventiaId,
    ...(acao ? { acao } : {}),
    ...(userId ? { userId } : {}),
    ...(entidade ? { entidade } : {}),
    ...(dataInicio || dataFim ? {
      timestamp: {
        ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
        ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59Z') } : {}),
      },
    } : {}),
  }

  const [total, entradas] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        userId: true,
        userEmail: true,
        userName: true,
        valorAnterior: true,
        valorNovo: true,
        timestamp: true,
        ipAddress: true,
        userAgent: true,
        hashIntegridade: true,
      },
    }),
  ])

  // Loga a consulta ao audit log (acesso a dados sensíveis é auditável)
  await logAudit({
    serventiaId: membro.serventiaId,
    userId: session.user.id,
    acao: 'EXPORTACAO_AUDITORIA',
    entidade: 'AuditLog',
    valorNovo: { filtros: { acao, userId, entidade, dataInicio, dataFim }, page, total },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({
    entradas,
    total,
    paginas: Math.ceil(total / PAGE_SIZE),
    paginaAtual: page,
    pageSize: PAGE_SIZE,
  })
}
