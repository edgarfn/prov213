import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import {
  getValidatedMembro,
  listUserServentias,
  getActiveServentiaId,
} from '@/lib/serventia-context'
import { db } from '@/lib/db'
import { getAlertasServentia } from '@/lib/alertas'
import { SidebarNav } from '@/components/sidebar-nav'
import { TopBar } from '@/components/top-bar'
import { IdleSessionGuard } from '@/components/idle-session-guard'
import type { ServentiaInfo } from '@/components/serventia-switcher'

import type { Session } from 'next-auth'

function SetupLayout({ children, user }: { children: React.ReactNode; user: Session['user'] }) {
  return (
    <IdleSessionGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <SidebarNav papel={undefined} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar user={user} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </IdleSessionGuard>
  )
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Primeiro acesso — deve trocar a senha antes de qualquer coisa
  const userRecord = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  })
  if (userRecord?.mustChangePassword) redirect('/alterar-senha')

  // Tenta resolver a serventia ativa via cookie
  const membro = await getValidatedMembro(session.user.id)

  if (!membro) {
    // Se não há cookie, tenta auto-selecionar quando há exatamente 1 serventia
    const cookieServentiaId = await getActiveServentiaId()
    if (!cookieServentiaId) {
      const membros = await listUserServentias(session.user.id)
      if (membros.length === 1) {
        // Redireciona para a rota que seta o cookie e volta ao dashboard
        redirect('/api/auth/auto-select')
      }
    }

    // Sem serventia ativa (0 serventias, múltiplas sem cookie, ou cookie inválido):
    // renderiza o layout em "modo setup" com sidebar e cabeçalho visíveis.
    // As páginas filhas (/onboarding, /selecionar-serventia) gerenciam seu próprio fluxo.
    return <SetupLayout user={session.user}>{children}</SetupLayout>
  }

  // Serventia ativa resolvida — layout completo com switcher
  const todosMembros = await listUserServentias(session.user.id)
  const todasServentias: ServentiaInfo[] = todosMembros.map((m) => ({
    id: m.serventia.id,
    nome: m.serventia.nome,
    municipio: m.serventia.municipio,
    uf: m.serventia.uf,
    classe: m.serventia.classe,
  }))

  const serventiaAtual: ServentiaInfo = {
    id: membro.serventia.id,
    nome: membro.serventia.nome,
    municipio: membro.serventia.municipio,
    uf: membro.serventia.uf,
    classe: membro.serventia.classe,
  }

  // Mesma fonte usada pelo painel do dashboard (lib/alertas.ts) — nunca recalculado aqui
  const resumoAlertas = membro.serventia.onboardingConcluido
    ? await getAlertasServentia(membro.serventia.id)
    : { totalCriticos: 0, totalAtencao: 0 }

  return (
    <IdleSessionGuard>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <SidebarNav
          papel={membro.papel}
          totalCriticos={resumoAlertas.totalCriticos}
          totalAtencao={resumoAlertas.totalAtencao}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            user={session.user}
            serventiaAtual={serventiaAtual}
            todasServentias={todasServentias}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </IdleSessionGuard>
  )
}
