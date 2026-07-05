import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { RelatoriosClient } from '@/components/relatorios-client'

export default async function RelatoriosPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')
  if (!['TITULAR', 'RESPONSAVEL_TECNICO'].includes(membro.papel)) redirect('/dashboard')

  const etapas = await db.etapa.findMany({
    orderBy: { numero: 'asc' },
    select: { id: true, numero: true, titulo: true },
  })

  return <RelatoriosClient classe={membro.serventia.classe} etapas={etapas} />
}
