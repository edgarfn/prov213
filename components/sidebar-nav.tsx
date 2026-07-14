'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Bug,
  HardDriveDownload,
  Database,
  Building2,
  Users,
  ScrollText,
  FileBarChart,
  Lightbulb,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  hideForAuditor?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/checklists', label: 'Checklists', icon: ClipboardList },
  { href: '/evidencias', label: 'Evidências', icon: FolderOpen },
  { href: '/incidentes', label: 'Incidentes', icon: ShieldAlert },
  { href: '/vulnerabilidades', label: 'Vulnerabilidades', icon: Bug },
  { href: '/testes-restauracao', label: 'Testes de Restauração', icon: HardDriveDownload },
  { href: '/recomendacoes-tecnicas', label: 'Recomendações Técnicas', icon: Lightbulb },
  { href: '/relatorios', label: 'Relatórios', icon: FileBarChart, hideForAuditor: true },
  { href: '/configuracoes/usuarios', label: 'Usuários', icon: Users, hideForAuditor: true },
  { href: '/configuracoes/backup', label: 'Backup', icon: Database, hideForAuditor: true },
  { href: '/configuracoes/auditoria', label: 'Auditoria', icon: ScrollText },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, exact: true },
  { href: '/selecionar-serventia', label: 'Serventias', icon: Building2, exact: true, hideForAuditor: true },
]

interface SidebarNavProps {
  papel?: string
  /** Contagem de alertas de prazo (lib/alertas.ts) — mesma fonte usada no painel do dashboard */
  totalCriticos?: number
  totalAtencao?: number
}

export function SidebarNav({ papel, totalCriticos = 0, totalAtencao = 0 }: SidebarNavProps) {
  const pathname = usePathname()
  const isAuditor = papel === 'AUDITOR_LEITURA'

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <ShieldCheck className="h-6 w-6 text-blue-600" />
        <span className="font-semibold text-lg">Prov213</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems
          .filter((item) => !(isAuditor && item.hideForAuditor))
          .map((item) => {
            const Icon = item.icon
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            const mostrarBadgeAlertas = item.href === '/dashboard' && (totalCriticos > 0 || totalAtencao > 0)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {mostrarBadgeAlertas && (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white',
                      totalCriticos > 0 ? 'bg-red-500' : 'bg-amber-500',
                    )}
                    title={`${totalCriticos + totalAtencao} alerta(s) de prazo`}
                  >
                    {totalCriticos + totalAtencao}
                  </span>
                )}
              </Link>
            )
          })}
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground text-center">
          Provimento CNJ nº 213/2026
        </p>
      </div>
    </aside>
  )
}
