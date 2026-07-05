import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { VulnerabilidadesClient } from '@/components/vulnerabilidades-client'

export default async function VulnerabilidadesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const vulnerabilidades = await db.vulnerabilidade.findMany({
    where: { serventiaId: membro.serventiaId },
    orderBy: { dataIdentificacao: 'desc' },
  })

  return (
    <VulnerabilidadesClient
      serventiaId={membro.serventiaId}
      vulnerabilidades={vulnerabilidades}
      papelAtual={membro.papel}
    />
  )
}
