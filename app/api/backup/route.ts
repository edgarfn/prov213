import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createBackup, listBackups } from '@/lib/backup'
import { getValidatedMembro } from '@/lib/serventia-context'

export const runtime = 'nodejs'

async function getServentiaAndRole(userId: string) {
  return getValidatedMembro(userId)
}

/** GET /api/backup — Lista backups da serventia */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getServentiaAndRole(session.user.id)
  if (!membro) {
    return NextResponse.json({ error: 'Serventia não encontrada' }, { status: 404 })
  }

  // Apenas TITULAR e RESPONSAVEL_TECNICO podem ver backups
  if (!['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const backups = await listBackups(membro.serventiaId)
  return NextResponse.json({ backups })
}

/** POST /api/backup — Cria novo backup */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const membro = await getServentiaAndRole(session.user.id)
  if (!membro) {
    return NextResponse.json({ error: 'Serventia não encontrada' }, { status: 404 })
  }

  // Apenas TITULAR pode criar backups (dados sensíveis)
  if (membro.papel !== 'TITULAR') {
    return NextResponse.json({ error: 'Apenas o Titular pode criar backups' }, { status: 403 })
  }

  const body = (await req.json()) as {
    encrypt?: boolean
    passphrase?: string
  }

  if (body.encrypt && (!body.passphrase || body.passphrase.length < 12)) {
    return NextResponse.json(
      { error: 'Frase-senha mínima de 12 caracteres para backup criptografado' },
      { status: 400 },
    )
  }

  try {
    const manifest = await createBackup({
      serventiaId: membro.serventiaId,
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      encrypt: !!body.encrypt,
      passphrase: body.passphrase,
    })

    return NextResponse.json({ success: true, manifest }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao criar backup'
    console.error('[Backup] Erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
