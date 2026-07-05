'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Clock,
  UserCircle,
  Pencil,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PAPEL_LABEL: Record<string, string> = {
  TITULAR: 'Titular',
  RESPONSAVEL_TECNICO: 'Resp. Técnico',
  DPO: 'DPO',
  COLABORADOR: 'Colaborador',
  AUDITOR_LEITURA: 'Visualização apenas',
  GESTOR_REGIONAL: 'Gestor Regional',
}

const PAPEL_COR: Record<string, string> = {
  TITULAR: 'text-blue-700 border-blue-200 bg-blue-50',
  RESPONSAVEL_TECNICO: 'text-purple-700 border-purple-200 bg-purple-50',
  DPO: 'text-green-700 border-green-200 bg-green-50',
  COLABORADOR: 'text-slate-700 border-slate-200 bg-slate-50',
  AUDITOR_LEITURA: 'text-amber-700 border-amber-200 bg-amber-50',
  GESTOR_REGIONAL: 'text-indigo-700 border-indigo-200 bg-indigo-50',
}

interface MembroItem {
  userId: string
  papel: string
  ativo: boolean
  user: { id: string; name: string | null; email: string; mustChangePassword: boolean; createdAt: string }
}

interface ServentiaOpcao {
  serventia: { id: string; nome: string; municipio: string; uf: string }
}

const FORM_INITIAL = { name: '', email: '', papel: 'AUDITOR_LEITURA', serventiaId: '' }

export default function UsuariosPage() {
  const [membros, setMembros] = useState<MembroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState(FORM_INITIAL)
  const [serventias, setServentias] = useState<ServentiaOpcao[]>([])
  const [loadingServentias, setLoadingServentias] = useState(false)

  // Edição de nome/e-mail
  const [editando, setEditando] = useState<MembroItem | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Ativar/desativar
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Exclusão permanente
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<MembroItem | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [excluirError, setExcluirError] = useState<string | null>(null)

  const fetchMembros = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const d = await res.json()
    setMembros(d.membros ?? [])
    setLoading(false)
  }, [])

  const fetchServentias = useCallback(async () => {
    setLoadingServentias(true)
    const res = await fetch('/api/usuario/serventias')
    const d = await res.json()
    setServentias(d.serventias ?? [])
    setLoadingServentias(false)
  }, [])

  useEffect(() => { fetchMembros() }, [fetchMembros])

  function openCreateModal() {
    setError(null)
    setForm(FORM_INITIAL)
    fetchServentias()
    setCreateOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validação explícita — Select não suporta 'required' nativo
    if (!form.name.trim()) { setError('Nome completo é obrigatório.'); return }
    if (!form.email.trim()) { setError('E-mail é obrigatório.'); return }
    if (!form.papel) { setError('Perfil de acesso é obrigatório.'); return }
    if (!form.serventiaId) { setError('Selecione a serventia para o usuário.'); return }

    setCreating(true)
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json()
    setCreating(false)

    if (!res.ok) {
      setError(d.error ?? 'Erro ao criar usuário.')
    } else {
      setCreateOpen(false)
      setForm(FORM_INITIAL)
      setSuccess('Usuário criado! Credenciais enviadas por e-mail (ou no console do servidor).')
      fetchMembros()
      setTimeout(() => setSuccess(null), 6000)
    }
  }

  async function handleChangePapel(userId: string, papel: string) {
    await fetch(`/api/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ papel }),
    })
    fetchMembros()
  }

  async function handleToggleAtivo(m: MembroItem) {
    setTogglingId(m.user.id)
    setError(null)
    const res = await fetch(`/api/usuarios/${m.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !m.ativo }),
    })
    setTogglingId(null)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erro ao alterar acesso.')
      return
    }
    setMembros((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, ativo: !m.ativo } : x)))
  }

  function abrirEdicao(m: MembroItem) {
    setEditando(m)
    setEditNome(m.user.name ?? '')
    setEditEmail(m.user.email)
    setEditError(null)
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setEditSaving(true)
    setEditError(null)

    const res = await fetch(`/api/usuarios/${editando.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editNome, email: editEmail }),
    })
    const d = await res.json()
    setEditSaving(false)

    if (!res.ok) {
      setEditError(d.error ?? 'Erro ao salvar alterações.')
      return
    }

    setMembros((prev) =>
      prev.map((x) =>
        x.userId === editando.userId
          ? { ...x, user: { ...x.user, name: editNome, email: editEmail.toLowerCase().trim() } }
          : x,
      ),
    )
    setEditando(null)
  }

  async function handleConfirmarExclusao() {
    if (!confirmandoExclusao) return
    setExcluindo(true)
    setExcluirError(null)

    const res = await fetch(`/api/usuarios/${confirmandoExclusao.user.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    setExcluindo(false)

    if (!res.ok) {
      setExcluirError(d.error ?? 'Erro ao excluir.')
      return
    }

    setMembros((prev) => prev.filter((m) => m.user.id !== confirmandoExclusao.user.id))
    setConfirmandoExclusao(null)
    setSuccess('Usuário excluído desta serventia.')
    setTimeout(() => setSuccess(null), 3000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie quem tem acesso a esta serventia e com qual perfil.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMembros} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar usuário
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

      {/* Descrição dos perfis */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Perfis disponíveis</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(PAPEL_LABEL).filter(([k]) => k !== 'TITULAR').map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-xs ${PAPEL_COR[k]}`}>{v}</Badge>
                {k === 'AUDITOR_LEITURA' && <span className="text-muted-foreground">— só visualiza, sem editar</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {membros.length} usuário(s) com acesso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-40" />
              Carregando…
            </div>
          ) : (
            <div className="space-y-3">
              {membros.map((m) => {
                const podeGerenciar = m.papel !== 'TITULAR'
                return (
                  <div
                    key={m.user.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${!m.ativo ? 'opacity-60 bg-slate-50' : ''}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 flex-shrink-0">
                      <UserCircle className="h-5 w-5 text-slate-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {m.user.name ?? m.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${PAPEL_COR[m.papel]}`}>
                          {PAPEL_LABEL[m.papel] ?? m.papel}
                        </Badge>
                        {!m.ativo && (
                          <Badge variant="outline" className="text-xs text-slate-500 border-slate-300 bg-slate-100">
                            Inativo
                          </Badge>
                        )}
                        {m.user.mustChangePassword && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
                            <Clock className="h-3 w-3 mr-1" />
                            Aguarda 1º acesso
                          </Badge>
                        )}
                        {!m.user.mustChangePassword && m.ativo && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-green-500" />
                            Ativo desde {format(new Date(m.user.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Alterar papel (não permite alterar o próprio Titular) */}
                    {podeGerenciar && (
                      <Select
                        value={m.papel}
                        onValueChange={(v) => { if (v) handleChangePapel(m.user.id, v) }}
                        disabled={!m.ativo}
                      >
                        <SelectTrigger className="w-36 text-xs">
                          <SelectValue>{(v: string) => PAPEL_LABEL[v] ?? v}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PAPEL_LABEL)
                            .filter(([k]) => k !== 'TITULAR')
                            .map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}

                    {podeGerenciar && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Editar nome/e-mail"
                          onClick={() => abrirEdicao(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-8 w-8 p-0 ${
                            m.ativo
                              ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-slate-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={m.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                          onClick={() => handleToggleAtivo(m)}
                          disabled={togglingId === m.user.id}
                        >
                          {togglingId === m.user.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : m.ativo ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Excluir permanentemente"
                          onClick={() => { setExcluirError(null); setConfirmandoExclusao(m) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de criação */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && !creating && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="space-y-1.5">
              <Label htmlFor="u-name">
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="u-name"
                placeholder="Ex: Maria Silva"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-email">
                E-mail <span className="text-red-500">*</span>
              </Label>
              <Input
                id="u-email"
                type="email"
                placeholder="usuario@cartorio.com.br"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Uma senha provisória será gerada e enviada por e-mail.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>
                Serventia com acesso <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.serventiaId}
                onValueChange={(v) => { if (v) setForm(p => ({ ...p, serventiaId: v })) }}
              >
                <SelectTrigger disabled={loadingServentias}>
                  <SelectValue>
                    {(id: string) => {
                      if (!id) return loadingServentias ? 'Carregando…' : 'Selecione a serventia'
                      const s = serventias.find((x) => x.serventia.id === id)
                      return s ? s.serventia.nome : 'Selecione a serventia'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {serventias.map((s) => (
                    <SelectItem key={s.serventia.id} value={s.serventia.id}>
                      {s.serventia.nome}
                      <span className="text-xs text-muted-foreground ml-2">
                        {s.serventia.municipio}/{s.serventia.uf}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O usuário terá acesso apenas à serventia selecionada.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>
                Perfil de acesso <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.papel}
                onValueChange={(v) => { if (v) setForm(p => ({ ...p, papel: v })) }}
              >
                <SelectTrigger><SelectValue>{(v: string) => PAPEL_LABEL[v] ?? v}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAPEL_LABEL)
                    .filter(([k]) => k !== 'TITULAR')
                    .map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                        {k === 'AUDITOR_LEITURA' && ' — só visualiza'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setCreateOpen(false); setError(null) }}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  creating ||
                  !form.name.trim() ||
                  !form.email.trim() ||
                  !form.papel ||
                  !form.serventiaId
                }
              >
                {creating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar e enviar convite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de edição de nome/e-mail */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && !editSaving && setEditando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalvarEdicao} className="space-y-4">
            {editError && <Alert variant="destructive"><AlertDescription>{editError}</AlertDescription></Alert>}
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Nome completo</Label>
              <Input id="e-name" value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">E-mail</Label>
              <Input id="e-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
              <p className="text-xs text-muted-foreground">
                Alterar o e-mail muda o login usado por esse usuário para entrar no sistema.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setEditando(null)} disabled={editSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editSaving || !editNome.trim() || !editEmail.trim()}>
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão permanente */}
      <Dialog open={!!confirmandoExclusao} onOpenChange={(o) => !o && !excluindo && setConfirmandoExclusao(null)}>
        <DialogContent className="max-w-sm">
          {confirmandoExclusao && (
            <>
              <DialogHeader>
                <DialogTitle>Excluir usuário permanentemente?</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {excluirError ? (
                  <Alert variant="destructive"><AlertDescription>{excluirError}</AlertDescription></Alert>
                ) : (
                  <p className="text-muted-foreground">
                    O acesso de <strong>{confirmandoExclusao.user.name ?? confirmandoExclusao.user.email}</strong> a
                    esta serventia será removido em definitivo — diferente de &ldquo;Desativar&rdquo;, isso não pode
                    ser desfeito. Se este usuário tiver qualquer histórico associado (auditoria, progresso de
                    checklist, incidentes ou vulnerabilidades), a exclusão será recusada automaticamente e você
                    deve usar &ldquo;Desativar&rdquo; no lugar.
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setConfirmandoExclusao(null)} disabled={excluindo}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={handleConfirmarExclusao} disabled={excluindo}>
                    {excluindo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Excluir
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
