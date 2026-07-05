import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { restoreBackup } from '@/lib/backup'
import { getValidatedMembro } from '@/lib/serventia-context'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/** POST /api/backup/[filename]/restore — Restaura o backup para a serventia ativa */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) {
    return NextResponse.json({ error: 'Serventia não encontrada' }, { status: 404 })
  }

  // Ação destrutiva sobre o estado operacional — apenas o Titular pode executar
  if (membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode restaurar backups' }, { status: 403 })
  }

  const { filename } = await params
  const body = (await req.json().catch(() => ({}))) as {
    passphrase?: string
    confirm?: boolean
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'Confirmação obrigatória para restaurar um backup' },
      { status: 400 },
    )
  }

  try {
    const summary = await restoreBackup({
      filename,
      passphrase: body.passphrase,
      serventiaId: membro.serventiaId,
      userId: session.user.id,
    })

    return NextResponse.json({ success: true, summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao restaurar backup'
    const status = msg.includes('senha') || msg.includes('autenticação') ? 401 : 500
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'restaurar_backup' })
    log.error({ filename, err: e }, 'Falha ao restaurar backup')
    return NextResponse.json({ error: msg }, { status })
  }
}
