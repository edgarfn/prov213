import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getValidatedMembro } from '@/lib/serventia-context'
import { parametrosPorClasse } from '@/lib/business-rules'
import { RecomendacoesTecnicasClient } from '@/components/recomendacoes-tecnicas-client'

export default async function RecomendacoesTecnicasPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const membro = await getValidatedMembro(session.user.id)
  if (!membro) redirect('/selecionar-serventia')
  if (!membro.serventia.onboardingConcluido) redirect('/onboarding')

  const serventiaId = membro.serventiaId

  const [recomendacoes, membrosAtivos] = await Promise.all([
    db.recomendacaoTecnica.findMany({
      where: { serventiaId },
      orderBy: { createdAt: 'desc' },
      include: {
        responsavelTecnico: { select: { name: true, email: true } },
        parecerDpoUser: { select: { name: true, email: true } },
        decisaoControlador: { select: { name: true, email: true } },
        responsavelExecucao: { select: { name: true, email: true } },
        ordemEmitidaPor: { select: { name: true, email: true } },
        aceiteTecnico: { select: { name: true, email: true } },
        aceiteControlador: { select: { name: true, email: true } },
        evidencias: { where: { deletedAt: null } },
      },
    }),
    db.membroServentia.findMany({
      where: { serventiaId, ativo: true },
      select: { papel: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ])

  const membros = membrosAtivos.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, papel: m.papel }))
  const existeDpo = membros.some((m) => m.papel === 'DPO')
  const existeTitular = membros.some((m) => m.papel === 'TITULAR')

  return (
    <RecomendacoesTecnicasClient
      serventiaId={serventiaId}
      recomendacoes={recomendacoes}
      membros={membros}
      papelAtual={membro.papel}
      existeDpo={existeDpo}
      existeTitular={existeTitular}
      retencaoAnos={parametrosPorClasse(membro.serventia.classe).retencaoAnos}
    />
  )
}
