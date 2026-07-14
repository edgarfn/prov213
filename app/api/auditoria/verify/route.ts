import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getValidatedMembro } from '@/lib/serventia-context'
import { verificarIntegridade } from '@/lib/audit'
import { getLogger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro || !['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  try {
    const resultado = await verificarIntegridade(membro.serventiaId)
    return NextResponse.json(resultado)
  } catch (err) {
    const log = await getLogger({ userId: session.user.id, serventiaId: membro.serventiaId, action: 'verificar_integridade_auditoria' })
    log.error({ err }, 'Falha inesperada ao verificar integridade da cadeia de auditoria')
    return NextResponse.json({ error: 'Erro interno. Tente novamente em instantes.' }, { status: 500 })
  }
}
