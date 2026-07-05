'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, ChevronDown, Plus, Check, Loader2 } from 'lucide-react'

export interface ServentiaInfo {
  id: string
  nome: string
  municipio: string
  uf: string
  classe: string
}

interface ServentiaSwitcherProps {
  current: ServentiaInfo
  all: ServentiaInfo[]
}

export function ServentiaSwitcher({ current, all }: ServentiaSwitcherProps) {
  const [switching, setSwitching] = useState<string | null>(null)

  const others = all.filter((s) => s.id !== current.id)

  async function switchTo(serventiaId: string) {
    setSwitching(serventiaId)
    const res = await fetch('/api/auth/select-serventia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serventiaId }),
    })
    if (res.ok) {
      // Hard navigation: garante que o novo cookie é enviado num request limpo.
      // router.refresh() + router.replace() não relê o cookie do servidor
      // na navegação client-side — causando a troca falhar na segunda vez.
      window.location.href = '/dashboard'
    } else {
      setSwitching(null)
    }
  }

  // Se só tem 1 serventia, exibe apenas o nome sem dropdown
  if (all.length <= 1) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-slate-700 px-2">
        <Building2 className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium truncate max-w-[180px]">{current.nome}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5
                                      text-sm hover:bg-slate-100 transition-colors outline-none
                                      data-popup-open:bg-slate-100">
        <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <span className="font-medium truncate max-w-[160px] text-slate-700">
          {current.nome}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={8}>
        {/* Serventia atual */}
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground">Serventia ativa</p>
          <p className="text-sm font-semibold flex items-center gap-1.5 mt-0.5">
            <Check className="h-3.5 w-3.5 text-green-600" />
            {current.nome}
          </p>
          <p className="text-xs text-muted-foreground">
            {current.municipio}/{current.uf}
          </p>
        </div>

        {others.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <p className="text-xs text-muted-foreground">Outras serventias</p>
            </div>
            {others.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => switchTo(s.id)}
                disabled={!!switching}
                className="gap-2"
              >
                {switching === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span className="truncate max-w-[200px]">{s.nome}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {s.municipio}/{s.uf}
                </span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { window.location.href = '/onboarding' }}
          className="gap-2 text-blue-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Cadastrar nova serventia
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
