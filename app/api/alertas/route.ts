import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getValidatedMembro } from '@/lib/serventia-context'
import { getAlertasServentia } from '@/lib/alertas'

export const runtime = 'nodejs'

/** GET /api/alertas — resumo de alertas de prazo da serventia ativa (para uso client-side, ex.: dropdown na sidebar) */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) return NextResponse.json({ error: 'Sem serventia ativa' }, { status: 403 })

  const resumo = await getAlertasServentia(membro.serventiaId)
  return NextResponse.json(resumo)
}
