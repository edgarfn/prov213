'use client'

import { signOut } from 'next-auth/react'
import type { Session } from 'next-auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserCircle, LogOut, ShieldCheck, Settings } from 'lucide-react'
import Link from 'next/link'
import { ServentiaSwitcher, type ServentiaInfo } from '@/components/serventia-switcher'

interface TopBarProps {
  user: Session['user']
  serventiaAtual?: ServentiaInfo
  todasServentias?: ServentiaInfo[]
}

export function TopBar({ user, serventiaAtual, todasServentias = [] }: TopBarProps) {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between gap-4">
      {/* Esquerda: logo (mobile) + seletor de serventia */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="md:hidden flex items-center gap-2 flex-shrink-0">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <span className="font-semibold">Prov213</span>
        </div>

        {serventiaAtual && (
          <ServentiaSwitcher
            current={serventiaAtual}
            all={todasServentias}
          />
        )}
      </div>

      {/* Direita: menu do usuário */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium
                     hover:bg-slate-100 transition-colors outline-none flex-shrink-0
                     data-popup-open:bg-slate-100"
        >
          <UserCircle className="h-5 w-5 text-slate-600" />
          <span className="hidden sm:inline text-slate-700 truncate max-w-[160px]">
            {user?.name ?? user?.email}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8}>
          <div className="px-2 py-1.5">
            {user?.name && (
              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {user.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {user?.email}
            </p>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem render={<Link href="/configuracoes" />} className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            className="gap-2"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
