import type { LucideIcon } from 'lucide-react'
import { ShieldCheck, Lock, History, FileCheck2 } from 'lucide-react'

const DESTAQUES = [
  { icon: Lock, texto: 'Autenticação em duas etapas (MFA) em todas as contas' },
  { icon: History, texto: 'Trilha de auditoria imutável, à prova de adulteração' },
  { icon: FileCheck2, texto: 'Evidências com hash SHA-256 e retenção de 5 anos' },
]

/**
 * Casca compartilhada das telas de conta (login, registro, recuperação/
 * redefinição/troca de senha) — um único lugar define o padrão visual dessas
 * telas em vez de cada página repetir seu próprio "min-h-screen + Card".
 * Painel de marca à esquerda (oculto em telas pequenas); conteúdo da página
 * à direita, via children.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Painel de marca — oculto abaixo de lg, o formulário assume a tela toda */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 px-12 py-12 text-white">
        <ShieldCheck
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 text-white/5"
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Prov213</span>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Copiloto de conformidade para o Provimento CNJ nº 213/2026
            </h1>
            <p className="text-sm text-blue-100/80">
              Checklists, evidências e prazos organizados — do primeiro acesso à declaração de
              conformidade perante a Corregedoria.
            </p>
          </div>
          <ul className="space-y-3">
            {DESTAQUES.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-start gap-2.5 text-sm text-blue-50/90">
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-200" />
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-100/50">
          TIC, segurança da informação e LGPD para serventias extrajudiciais
        </p>
      </div>

      {/* Conteúdo da página */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          {/* Marca — só aparece aqui quando o painel lateral está oculto (telas pequenas) */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-slate-900">Prov213</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

interface AuthHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  /** 'amber' sinaliza ação necessária (ex.: troca de senha obrigatória) */
  tone?: 'blue' | 'amber'
}

/** Bloco de ícone + título + descrição usado no topo de cada tela — mesma hierarquia em todas. */
export function AuthHeader({ icon: Icon, title, description, tone = 'blue' }: AuthHeaderProps) {
  return (
    <div className="mb-8">
      <div
        className={
          'mb-4 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ' +
          (tone === 'amber' ? 'bg-amber-50 ring-amber-100' : 'bg-blue-50 ring-blue-100')
        }
      >
        <Icon className={`h-5 w-5 ${tone === 'amber' ? 'text-amber-600' : 'text-blue-600'}`} />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
