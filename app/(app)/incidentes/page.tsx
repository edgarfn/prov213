import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { IncidentesClient } from '@/components/incidentes-client'

export default async function IncidentesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const incidentes = await db.incidente.findMany({
    where: { serventiaId: membro.serventiaId },
    orderBy: { dataCiencia: 'desc' },
  })

  return (
    <IncidentesClient
      serventiaId={membro.serventiaId}
      incidentes={incidentes}
      papelAtual={membro.papel}
    />
  )
}
