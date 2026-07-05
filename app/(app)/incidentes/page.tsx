import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { parametrosPorClasse } from '@/lib/business-rules'
import { IncidentesClient } from '@/components/incidentes-client'

export default async function IncidentesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const [incidentes, usuarios] = await Promise.all([
    db.incidente.findMany({
      where: { serventiaId: membro.serventiaId },
      orderBy: { dataCiencia: 'desc' },
      include: {
        responsavel: { select: { name: true, email: true } },
        evidencias: { where: { deletedAt: null } },
      },
    }),
    db.user.findMany({
      where: { membros: { some: { serventiaId: membro.serventiaId } } },
      select: { id: true, name: true, email: true },
    }),
  ])

  return (
    <IncidentesClient
      serventiaId={membro.serventiaId}
      incidentes={incidentes}
      usuarios={usuarios}
      papelAtual={membro.papel}
      retencaoAnos={parametrosPorClasse(membro.serventia.classe).retencaoAnos}
    />
  )
}
