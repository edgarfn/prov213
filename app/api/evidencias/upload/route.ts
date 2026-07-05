import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createHash } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

const UPLOAD_BASE = path.join(process.cwd(), 'uploads')
const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const serventiaId = formData.get('serventiaId') as string
  const requisitoId = (formData.get('requisitoId') as string) || null
  const testeRestauracaoId = (formData.get('testeRestauracaoId') as string) || null
  const incidenteId = (formData.get('incidenteId') as string) || null
  const vulnerabilidadeId = (formData.get('vulnerabilidadeId') as string) || null
  const tipo = (formData.get('tipo') as string) || 'DOCUMENTO'

  const origensInformadas = [requisitoId, testeRestauracaoId, incidenteId, vulnerabilidadeId].filter(Boolean).length
  if (!file || !serventiaId || origensInformadas !== 1) {
    return NextResponse.json(
      { error: 'Informe o arquivo, a serventia e exatamente uma origem: requisitoId, testeRestauracaoId, incidenteId ou vulnerabilidadeId' },
      { status: 400 },
    )
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo excede 50 MB' }, { status: 413 })
  }

  // Verificar permissão
  const membro = await db.membroServentia.findUnique({
    where: { userId_serventiaId: { userId: session.user.id, serventiaId } },
  })
  if (!membro || membro.papel === 'AUDITOR_LEITURA') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Resolve a origem (requisito, teste de restauração, incidente ou vulnerabilidade), validando que pertence à serventia
  let origemId: string
  let evidenciaData: {
    progressoRequisitoId?: string
    testeRestauracaoId?: string
    incidenteId?: string
    vulnerabilidadeId?: string
  }
  if (requisitoId) {
    const progresso = await db.progressoRequisito.findUnique({
      where: { serventiaId_requisitoId: { serventiaId, requisitoId } },
    })
    if (!progresso) {
      return NextResponse.json({ error: 'Requisito não encontrado para esta serventia' }, { status: 404 })
    }
    origemId = progresso.id
    evidenciaData = { progressoRequisitoId: progresso.id }
  } else if (testeRestauracaoId) {
    const teste = await db.testeRestauracao.findFirst({
      where: { id: testeRestauracaoId, serventiaId },
    })
    if (!teste) {
      return NextResponse.json({ error: 'Teste de restauração não encontrado para esta serventia' }, { status: 404 })
    }
    origemId = teste.id
    evidenciaData = { testeRestauracaoId: teste.id }
  } else if (incidenteId) {
    const incidente = await db.incidente.findFirst({
      where: { id: incidenteId, serventiaId },
    })
    if (!incidente) {
      return NextResponse.json({ error: 'Incidente não encontrado para esta serventia' }, { status: 404 })
    }
    origemId = incidente.id
    evidenciaData = { incidenteId: incidente.id }
  } else {
    const vulnerabilidade = await db.vulnerabilidade.findFirst({
      where: { id: vulnerabilidadeId!, serventiaId },
    })
    if (!vulnerabilidade) {
      return NextResponse.json({ error: 'Vulnerabilidade não encontrada para esta serventia' }, { status: 404 })
    }
    origemId = vulnerabilidade.id
    evidenciaData = { vulnerabilidadeId: vulnerabilidade.id }
  }

  // Calcular SHA-256
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const hashSha256 = createHash('sha256').update(buffer).digest('hex')

  // Salvar arquivo
  const uploadDir = path.join(UPLOAD_BASE, serventiaId, origemId)
  await mkdir(uploadDir, { recursive: true })

  const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = path.join(uploadDir, safeFileName)
  await writeFile(filePath, buffer)

  const storagePath = path.join(serventiaId, origemId, safeFileName)

  const evidencia = await db.evidencia.create({
    data: {
      ...evidenciaData,
      nomeArquivo: file.name,
      storagePath,
      hashSha256,
      tamanhoBytes: file.size,
      tipo: tipo as 'DOCUMENTO' | 'CONTRATO' | 'PRINT' | 'LOG' | 'RELATORIO' | 'ATA',
      uploadedBy: session.user.id,
    },
  })

  await logAudit({
    serventiaId,
    userId: session.user.id,
    acao: 'EVIDENCIA_UPLOAD',
    entidade: 'Evidencia',
    entidadeId: evidencia.id,
    valorNovo: { nomeArquivo: file.name, hashSha256, tamanhoBytes: file.size, tipo, requisitoId, testeRestauracaoId, incidenteId, vulnerabilidadeId },
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
  })

  return NextResponse.json({
    success: true,
    evidencia: {
      id: evidencia.id,
      nomeArquivo: evidencia.nomeArquivo,
      hashSha256: evidencia.hashSha256,
      tipo: evidencia.tipo,
      tamanhoBytes: evidencia.tamanhoBytes,
    },
  })
}
