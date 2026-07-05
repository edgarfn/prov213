'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronRight, Loader2, Plus, Pencil, Power, PowerOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EditarServentiaDialog, type ServentiaEditavel } from '@/components/editar-serventia-dialog'
import { alternarAtivaServentia } from '@/app/actions/serventia'

interface ServentiaItem {
  papel: string
  serventia: ServentiaEditavel & {
    municipio: string
    uf: string
    classe: string
    onboardingConcluido: boolean
    ativa: boolean
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
  const [editando, setEditando] = useState<ServentiaItem | null>(null)
  const [confirmandoToggle, setConfirmandoToggle] = useState<ServentiaItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

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

  function handleSaved(serventiaId: string, dadosNovos: Partial<ServentiaEditavel>) {
    setServentias((prev) =>
      prev.map((item) =>
        item.serventia.id === serventiaId
          ? { ...item, serventia: { ...item.serventia, ...dadosNovos } }
          : item,
      ),
    )
  }

  async function handleConfirmarToggle() {
    if (!confirmandoToggle) return
    const novaAtiva = !confirmandoToggle.serventia.ativa
    setTogglingId(confirmandoToggle.serventia.id)
    setError(null)

    const result = await alternarAtivaServentia(confirmandoToggle.serventia.id, novaAtiva)
    setTogglingId(null)
    setConfirmandoToggle(null)

    if (result.error) {
      setError(result.error)
      return
    }

    setServentias((prev) =>
      prev.map((item) =>
        item.serventia.id === confirmandoToggle.serventia.id
          ? { ...item, serventia: { ...item.serventia, ativa: novaAtiva } }
          : item,
      ),
    )
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
            const podeEditar = ['TITULAR', 'RESPONSAVEL_TECNICO'].includes(item.papel)
            const podeAtivarInativar = item.papel === 'TITULAR'
            const ativa = item.serventia.ativa

            return (
              <div
                key={item.serventia.id}
                className={`rounded-xl border bg-white p-4 transition-all ${
                  ativa ? 'hover:border-blue-400 hover:shadow-sm' : 'opacity-75'
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => ativa && handleSelect(item.serventia.id)}
                    disabled={!!selecting || !ativa}
                    className="flex flex-1 items-center gap-4 text-left min-w-0 focus:outline-none disabled:cursor-not-allowed"
                  >
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
                        {!ativa && (
                          <Badge
                            variant="outline"
                            className="text-xs text-slate-500 border-slate-300 bg-slate-100"
                          >
                            Inativa
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {podeEditar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        title="Editar dados da serventia"
                        onClick={(e) => { e.stopPropagation(); setEditando(item) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {podeAtivarInativar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-8 w-8 p-0 ${
                          ativa
                            ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                            : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={ativa ? 'Inativar serventia' : 'Reativar serventia'}
                        onClick={(e) => { e.stopPropagation(); setConfirmandoToggle(item) }}
                      >
                        {ativa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                    )}
                    {ativa && <ChevronRight className="h-5 w-5 text-slate-400" />}
                  </div>
                </div>
              </div>
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

      {editando && (
        <EditarServentiaDialog
          serventia={editando.serventia}
          open={!!editando}
          onOpenChange={(o) => !o && setEditando(null)}
          onSaved={handleSaved}
        />
      )}

      <Dialog open={!!confirmandoToggle} onOpenChange={(o) => !o && setConfirmandoToggle(null)}>
        <DialogContent className="max-w-sm">
          {confirmandoToggle && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirmandoToggle.serventia.ativa ? 'Inativar serventia?' : 'Reativar serventia?'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {confirmandoToggle.serventia.ativa ? (
                  <p className="text-muted-foreground">
                    <strong>{confirmandoToggle.serventia.nome}</strong> ficará inacessível para todos
                    os usuários vinculados — ninguém conseguirá abrir checklists, registrar
                    incidentes/vulnerabilidades ou acessar o dossiê enquanto estiver inativa. Todo o
                    histórico e as evidências já registradas são preservados (retenção obrigatória de
                    5 anos) e podem ser reativados a qualquer momento por um Titular.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    <strong>{confirmandoToggle.serventia.nome}</strong> voltará a ficar acessível para
                    todos os usuários vinculados.
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setConfirmandoToggle(null)} disabled={!!togglingId}>
                    Cancelar
                  </Button>
                  <Button
                    variant={confirmandoToggle.serventia.ativa ? 'destructive' : 'default'}
                    onClick={handleConfirmarToggle}
                    disabled={!!togglingId}
                  >
                    {togglingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {confirmandoToggle.serventia.ativa ? 'Inativar' : 'Reativar'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
