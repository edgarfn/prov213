import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

const UPLOAD_BASE = path.join(process.cwd(), 'uploads')

/** GET /api/evidencias/[id]/download — Faz download com verificação de integridade */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  try {
    const ev = await db.evidencia.findUnique({
      where: { id },
      include: {
        progressoRequisito: { select: { serventiaId: true } },
        testeRestauracao: { select: { serventiaId: true } },
      },
    })

    if (!ev || ev.deletedAt) {
      return NextResponse.json({ error: 'Evidência não encontrada' }, { status: 404 })
    }

    // Uma evidência sempre tem exatamente uma origem (CHECK constraint no banco)
    const serventiaId = ev.progressoRequisito?.serventiaId ?? ev.testeRestauracao!.serventiaId

    // Verifica que o usuário pertence à serventia da evidência
    const membro = await getValidatedMembro(session.user.id)
    if (!membro || membro.serventiaId !== serventiaId) {
      await logAudit({
        serventiaId,
        userId: session.user.id,
        acao: 'ACESSO_NEGADO',
        entidade: 'Evidencia',
        entidadeId: id,
        valorNovo: { motivo: 'serventia_diferente_no_download' },
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Lê o arquivo do disco
    const filePath = path.join(UPLOAD_BASE, ev.storagePath)
    let buffer: Buffer
    try {
      buffer = await readFile(filePath)
    } catch (err) {
      // Arquivo fisicamente ausente é um sinal sério aqui: a evidência está
      // registrada (hash e metadados intactos no banco) mas o arquivo por
      // trás dela sumiu do disco — possível violação da retenção obrigatória
      // de 5 anos (Art. 7º, IV). Não pode passar em silêncio como um 404 comum.
      const log = await getLogger({ userId: session.user.id, serventiaId, action: 'download_evidencia' })
      log.error({ err, evidenciaId: id, storagePath: ev.storagePath }, 'Arquivo físico de evidência não encontrado no armazenamento')
      return NextResponse.json({ error: 'Arquivo não encontrado no armazenamento' }, { status: 404 })
    }

    // Verifica integridade SHA-256 antes de servir o arquivo
    const hashAtual = createHash('sha256').update(buffer).digest('hex')
    const integro = hashAtual === ev.hashSha256

    await logAudit({
      serventiaId,
      userId: session.user.id,
      acao: 'EVIDENCIA_DOWNLOAD',
      entidade: 'Evidencia',
      entidadeId: id,
      valorNovo: {
        nomeArquivo: ev.nomeArquivo,
        tipo: ev.tipo,
        tamanhoBytes: ev.tamanhoBytes,
        hashSha256: ev.hashSha256,
        hashVerificado: hashAtual,
        integridadeOk: integro,
      },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })

    if (!integro) {
      // Loga a falha mas ainda serve o arquivo (o auditor decide o que fazer) —
      // possível indício de adulteração do arquivo em disco, merece atenção operacional
      const log = await getLogger({ userId: session.user.id, serventiaId, action: 'download_evidencia' })
      log.error(
        { evidenciaId: id, hashEsperado: ev.hashSha256, hashAtual },
        'Falha de integridade detectada no download de evidência',
      )
    }

    // Detecta Content-Type pela extensão
    const ext = ev.nomeArquivo.split('.').pop()?.toLowerCase() ?? ''
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
      eml: 'message/rfc822',
      log: 'text/plain',
    }
    const contentType = mimeTypes[ext] ?? 'application/octet-stream'

    // Adiciona header de aviso se a integridade falhou
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(ev.nomeArquivo)}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store, no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-SHA256': ev.hashSha256,
      'X-Integrity': integro ? 'ok' : 'FAILED',
    }

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, action: 'download_evidencia' })
    log.error({ err, evidenciaId: id }, 'Falha inesperada ao processar download de evidência')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
