import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getBackupPlaintext, deleteBackup } from '@/lib/backup'
import { getValidatedMembro } from '@/lib/serventia-context'
import { logAudit } from '@/lib/audit'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

async function getServentiaAndRole(userId: string) {
  return getValidatedMembro(userId)
}

/** POST /api/backup/[filename] — Faz download (aceita passphrase no body) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getServentiaAndRole(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { filename } = await params
  const body = (await req.json().catch(() => ({}))) as { passphrase?: string }

  try {
    const plaintext = await getBackupPlaintext(filename, body.passphrase)

    await logAudit({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      acao: 'BACKUP_DOWNLOAD',
      entidade: 'Backup',
      valorNovo: { filename, sizeBytes: plaintext.length },
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })

    return new NextResponse(new Uint8Array(plaintext), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename.replace('_enc', '')}"`,
        'Content-Length': String(plaintext.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro no download'
    const status = msg.includes('senha') || msg.includes('autenticação') ? 401 : 500
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'download_backup' })
    if (status === 401) {
      log.warn({ filename, err: e }, 'Tentativa de download de backup com frase-senha incorreta')
    } else {
      log.error({ filename, err: e }, 'Falha ao processar download de backup')
    }
    return NextResponse.json({ error: msg }, { status })
  }
}

/** DELETE /api/backup/[filename] — Exclui backup */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getServentiaAndRole(session.user.id)
  if (!membro || membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode excluir backups' }, { status: 403 })
  }

  const { filename } = await params

  try {
    await deleteBackup(filename, session.user.id, membro.serventiaId)
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao excluir'
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'excluir_backup' })
    log.error({ filename, err: e }, 'Falha ao excluir backup')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
