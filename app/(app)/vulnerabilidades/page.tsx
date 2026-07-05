import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { parametrosPorClasse } from '@/lib/business-rules'
import { VulnerabilidadesClient } from '@/components/vulnerabilidades-client'

export default async function VulnerabilidadesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const [vulnerabilidades, usuarios] = await Promise.all([
    db.vulnerabilidade.findMany({
      where: { serventiaId: membro.serventiaId },
      orderBy: { dataIdentificacao: 'desc' },
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
    <VulnerabilidadesClient
      serventiaId={membro.serventiaId}
      vulnerabilidades={vulnerabilidades}
      usuarios={usuarios}
      papelAtual={membro.papel}
      retencaoAnos={parametrosPorClasse(membro.serventia.classe).retencaoAnos}
    />
  )
}
