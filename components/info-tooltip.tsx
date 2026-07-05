'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import { EXPLICACOES_LEIGO, type ExplicacaoLeigoChave } from '@/lib/explicacoes-leigo'

interface InfoTooltipProps {
  chave: ExplicacaoLeigoChave
  className?: string
}

/** Ícone "?" com explicação em linguagem simples — mesmo padrão usado nos Checklists. */
export function InfoTooltip({ chave, className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <HelpCircle className={className ?? 'h-3.5 w-3.5 text-slate-400 hover:text-blue-600 cursor-help'} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{EXPLICACOES_LEIGO[chave]}</TooltipContent>
    </Tooltip>
  )
}
