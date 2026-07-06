import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { AtivosClient } from '@/components/ativos-client'

export default async function AtivosPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const [ativos, usuarios] = await Promise.all([
    db.ativo.findMany({
      where: { serventiaId: membro.serventiaId },
      orderBy: { createdAt: 'desc' },
      include: {
        responsavel: { select: { name: true, email: true } },
        vulnerabilidades: {
          select: { id: true, descricao: true, status: true, classificacaoRisco: true },
        },
      },
    }),
    db.user.findMany({
      where: { membros: { some: { serventiaId: membro.serventiaId } } },
      select: { id: true, name: true, email: true },
    }),
  ])

  return (
    <AtivosClient
      serventiaId={membro.serventiaId}
      ativos={ativos}
      usuarios={usuarios}
      papelAtual={membro.papel}
    />
  )
}
