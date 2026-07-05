import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SessionProvider } from '@/components/session-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Prov213 — Copiloto de Conformidade CNJ',
  description: 'Sistema de gestão da implantação do Provimento CNJ nº 213/2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      {/* suppressHydrationWarning: extensões de browser (ex: gerenciadores de senha)
          injetam elementos no DOM antes do React hidratar — isso gera diferença
          entre o HTML do servidor e do cliente. A prop suprime o aviso para o <body>
          sem afetar a detecção de erros nos componentes filhos. */}
      <body className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
        <SessionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
