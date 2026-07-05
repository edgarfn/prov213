import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { ChecklistsClient } from '@/components/checklists-client'

export default async function ChecklistsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')

  const serventia = membro.serventia

  const etapas = await db.etapa.findMany({
    orderBy: { numero: 'asc' },
    include: {
      requisitos: {
        where: { classesAplicaveis: { has: serventia.classe } },
        orderBy: { codigo: 'asc' },
        include: {
          progressos: {
            where: { serventiaId: serventia.id },
            include: {
              evidencias: { where: { deletedAt: null } },
              responsavel: { select: { name: true, email: true } },
            },
          },
        },
      },
      declaracoes: { where: { serventiaId: serventia.id } },
    },
  })

  const usuarios = await db.user.findMany({
    where: { membros: { some: { serventiaId: serventia.id } } },
    select: { id: true, name: true, email: true },
  })

  return (
    <ChecklistsClient
      serventia={serventia}
      etapas={etapas}
      usuarios={usuarios}
      papelAtual={membro.papel}
    />
  )
}
