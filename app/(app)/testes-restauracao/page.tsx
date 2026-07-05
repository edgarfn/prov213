import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { parametrosPorClasse } from '@/lib/business-rules'
import { TestesRestauracaoClient } from '@/components/testes-restauracao-client'
import type { ClasseServentia } from '@/types/prisma'

export default async function TestesRestauracaoPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const testes = await db.testeRestauracao.findMany({
    where: { serventiaId: membro.serventiaId },
    orderBy: { dataTeste: 'desc' },
    include: { evidencias: { where: { deletedAt: null }, orderBy: { uploadedAt: 'asc' } } },
  })

  const params = parametrosPorClasse(membro.serventia.classe as ClasseServentia)

  return (
    <TestesRestauracaoClient
      serventiaId={membro.serventiaId}
      testes={testes}
      papelAtual={membro.papel}
      rtoDefinido={params.rtoHoras}
      rpoDefinido={params.rpoHoras}
      periodicidadeMeses={params.testeRestauracaoMeses}
      retencaoAnos={params.retencaoAnos}
    />
  )
}
