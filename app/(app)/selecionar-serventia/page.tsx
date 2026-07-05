'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronRight, Loader2, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ServentiaItem {
  papel: string
  serventia: {
    id: string
    nome: string
    cns: string
    municipio: string
    uf: string
    classe: string
    onboardingConcluido: boolean
  }
}

const CLASSE_LABEL: Record<string, string> = {
  CLASSE_1: 'Classe 1',
  CLASSE_2: 'Classe 2',
  CLASSE_3: 'Classe 3',
}

const PAPEL_LABEL: Record<string, string> = {
  TITULAR: 'Titular',
  RESPONSAVEL_TECNICO: 'Resp. Técnico',
  DPO: 'DPO',
  COLABORADOR: 'Colaborador',
  AUDITOR_LEITURA: 'Auditor',
  GESTOR_REGIONAL: 'Gestor Regional',
}

export default function SelecionarServentiaPage() {
  const [serventias, setServentias] = useState<ServentiaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/usuario/serventias')
      .then((r) => r.json())
      .then((d) => setServentias(d.serventias ?? []))
      .catch(() => setError('Não foi possível carregar as serventias.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSelect(serventiaId: string) {
    setSelecting(serventiaId)
    setError(null)

    const res = await fetch('/api/auth/select-serventia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serventiaId }),
    })

    if (!res.ok) {
      setError('Não foi possível selecionar essa serventia.')
      setSelecting(null)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Selecionar Serventia</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha em qual serventia deseja trabalhar
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm text-muted-foreground mt-2">Carregando…</p>
        </div>
      ) : serventias.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <Building2 className="h-12 w-12 mx-auto text-slate-300" />
            <div>
              <p className="font-medium">Nenhuma serventia vinculada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você ainda não tem acesso a nenhuma serventia.
              </p>
            </div>
            <Button onClick={() => { window.location.href = '/onboarding' }}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar serventia
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {serventias.map((item) => {
            const isSelecting = selecting === item.serventia.id
            return (
              <button
                key={item.serventia.id}
                onClick={() => handleSelect(item.serventia.id)}
                disabled={!!selecting}
                className="w-full text-left rounded-xl border bg-white p-4 hover:border-blue-400
                           hover:shadow-sm transition-all focus:outline-none focus:ring-2
                           focus:ring-blue-500 disabled:opacity-60"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
                    {isSelecting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    ) : (
                      <Building2 className="h-5 w-5 text-blue-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {item.serventia.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.serventia.municipio}/{item.serventia.uf} · CNS{' '}
                      {item.serventia.cns}
                    </p>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {CLASSE_LABEL[item.serventia.classe] ?? item.serventia.classe}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs text-blue-700 border-blue-200 bg-blue-50"
                      >
                        {PAPEL_LABEL[item.papel] ?? item.papel}
                      </Badge>
                      {!item.serventia.onboardingConcluido && (
                        <Badge
                          variant="outline"
                          className="text-xs text-amber-700 border-amber-200 bg-amber-50"
                        >
                          Configuração pendente
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {serventias.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { window.location.href = '/onboarding' }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Cadastrar nova serventia
        </Button>
      )}
    </div>
  )
}
