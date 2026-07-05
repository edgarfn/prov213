'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Upload, FileText, Loader2, Paperclip,
  Pencil, Trash2, Check, X, ShieldAlert, Download, Lock,
} from 'lucide-react'
import type { Evidencia, TipoEvidencia } from '@/types/prisma'
import { evidenciaBloqueadaPorRetencao, dataLimiteRetencaoEvidencia } from '@/lib/business-rules'

const TIPOS_EVIDENCIA = [
  { value: 'DOCUMENTO', label: 'Documento' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'PRINT', label: 'Print de tela' },
  { value: 'LOG', label: 'Log' },
  { value: 'RELATORIO', label: 'Relatório' },
  { value: 'ATA', label: 'Ata' },
]

interface EvidenciasUploadProps {
  serventiaId: string
  /** Origem da evidência — exatamente uma delas deve ser informada */
  requisitoId?: string
  testeRestauracaoId?: string
  incidenteId?: string
  vulnerabilidadeId?: string
  evidencias: Evidencia[]
  /** Se false, esconde os botões de ação (modo leitura) */
  podeEditar?: boolean
  /** Se false, esconde o botão de exclusão */
  podeExcluir?: boolean
  /** Prazo de retenção obrigatória (Art. 7º, IV) — bloqueia exclusão dentro do prazo */
  retencaoAnos?: number
}

interface EditState {
  id: string
  nomeArquivo: string
  tipo: string
  saving: boolean
}

export function EvidenciasUpload({
  serventiaId,
  requisitoId,
  testeRestauracaoId,
  incidenteId,
  vulnerabilidadeId,
  evidencias,
  podeEditar = true,
  podeExcluir = true,
  retencaoAnos = 5,
}: EvidenciasUploadProps) {
  const [lista, setLista] = useState<Evidencia[]>(evidencias)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tipo, setTipo] = useState('DOCUMENTO')
  const fileRef = useRef<HTMLInputElement>(null)

  // Estado de edição inline
  const [editando, setEditando] = useState<EditState | null>(null)
  // Confirmação de exclusão
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  // ─── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setErro(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('serventiaId', serventiaId)
    if (requisitoId) fd.append('requisitoId', requisitoId)
    if (testeRestauracaoId) fd.append('testeRestauracaoId', testeRestauracaoId)
    if (incidenteId) fd.append('incidenteId', incidenteId)
    if (vulnerabilidadeId) fd.append('vulnerabilidadeId', vulnerabilidadeId)
    fd.append('tipo', tipo)

    try {
      const res = await fetch('/api/evidencias/upload', { method: 'POST', body: fd })
      const json = await res.json() as { error?: string; evidencia?: Evidencia }

      if (!res.ok) {
        setErro(json.error ?? 'Erro no upload')
      } else if (json.evidencia) {
        setLista((p) => [...p, json.evidencia as Evidencia])
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ─── Edição inline ─────────────────────────────────────────────────────────

  function iniciarEdicao(ev: Evidencia) {
    setEditando({ id: ev.id, nomeArquivo: ev.nomeArquivo, tipo: ev.tipo, saving: false })
    setConfirmandoExclusao(null)
    setErro(null)
  }

  function cancelarEdicao() {
    setEditando(null)
  }

  async function salvarEdicao() {
    if (!editando) return
    setEditando((p) => p ? { ...p, saving: true } : null)
    setErro(null)

    const res = await fetch(`/api/evidencias/${editando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: editando.tipo, nomeArquivo: editando.nomeArquivo }),
    })
    const json = await res.json()

    if (!res.ok) {
      setErro(json.error ?? 'Erro ao salvar alterações.')
      setEditando((p) => p ? { ...p, saving: false } : null)
      return
    }

    setLista((prev) =>
      prev.map((ev) =>
        ev.id === editando.id
          ? { ...ev, tipo: editando.tipo as TipoEvidencia, nomeArquivo: editando.nomeArquivo }
          : ev,
      ),
    )
    setEditando(null)
  }

  // ─── Exclusão (soft-delete) ────────────────────────────────────────────────

  function pedirConfirmacaoExclusao(id: string) {
    setConfirmandoExclusao(id)
    setEditando(null)
    setErro(null)
  }

  async function confirmarExclusao(id: string) {
    setExcluindo(id)
    setErro(null)

    const res = await fetch(`/api/evidencias/${id}`, { method: 'DELETE' })
    const json = await res.json()

    setExcluindo(null)
    setConfirmandoExclusao(null)

    if (!res.ok) {
      setErro(json.error ?? 'Erro ao excluir evidência.')
      return
    }

    setLista((prev) => prev.filter((ev) => ev.id !== id))
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function labelTipo(t: string) {
    return TIPOS_EVIDENCIA.find((x) => x.value === t)?.label ?? t
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Evidências</p>

      {lista.length > 0 && (
        <div className="space-y-2">
          {lista.map((ev) => {
            const isEditando = editando?.id === ev.id
            const isConfirmando = confirmandoExclusao === ev.id
            const isExcluindo = excluindo === ev.id

            return (
              <div
                key={ev.id}
                className={`rounded-lg border bg-slate-50 p-2 text-sm transition-colors ${
                  isConfirmando ? 'border-red-300 bg-red-50' : ''
                }`}
              >
                {/* Modo edição inline */}
                {isEditando ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Pencil className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-blue-700">Editando metadados</span>
                      <span className="text-xs text-muted-foreground">
                        (o arquivo e o hash SHA-256 são imutáveis)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={editando!.nomeArquivo}
                        onChange={(e) => setEditando((p) => p ? { ...p, nomeArquivo: e.target.value } : null)}
                        className="text-sm h-8 flex-1"
                        placeholder="Nome do arquivo"
                      />
                      <Select
                        value={editando!.tipo}
                        onValueChange={(v) => { if (v) setEditando((p) => p ? { ...p, tipo: v } : null) }}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue>{labelTipo}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_EVIDENCIA.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={salvarEdicao}
                        disabled={editando!.saving || !editando!.nomeArquivo.trim()}
                      >
                        {editando!.saving ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelarEdicao}>
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : isConfirmando ? (
                  /* Confirmação de exclusão */
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-red-700">Confirmar exclusão</p>
                        <p className="text-red-600 mt-0.5">
                          <span className="font-medium">{ev.nomeArquivo}</span> será marcada como excluída.
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          O arquivo e o hash SHA-256 são preservados por 5 anos (Art. 7º). A exclusão é registrada na auditoria.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => confirmarExclusao(ev.id)}
                        disabled={isExcluindo}
                      >
                        {isExcluindo ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        Confirmar exclusão
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setConfirmandoExclusao(null)}
                        disabled={isExcluindo}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Modo exibição normal */
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ev.nomeArquivo}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">
                          SHA256: {ev.hashSha256.slice(0, 16)}…
                        </span>
                        <Badge variant="outline" className="text-xs">{labelTipo(ev.tipo)}</Badge>
                        <span className="text-xs text-muted-foreground">{formatBytes(ev.tamanhoBytes)}</span>
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Download — disponível para todos os membros ativos */}
                      <a
                        href={`/api/evidencias/${ev.id}/download`}
                        download={ev.nomeArquivo}
                        title={`Baixar ${ev.nomeArquivo}`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500
                                   hover:text-green-700 hover:bg-green-50 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>

                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => iniciarEdicao(ev)}
                          title="Alterar tipo ou nome"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {podeExcluir && (() => {
                        const bloqueada = evidenciaBloqueadaPorRetencao(new Date(ev.uploadedAt), retencaoAnos)
                        if (!bloqueada) {
                          return (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => pedirConfirmacaoExclusao(ev.id)}
                              title="Excluir evidência"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )
                        }
                        const dataLimite = dataLimiteRetencaoEvidencia(new Date(ev.uploadedAt), retencaoAnos)
                        return (
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-300 cursor-not-allowed"
                                disabled
                                title="Exclusão bloqueada pela retenção obrigatória"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Retenção obrigatória de {retencaoAnos} anos (Art. 7º, IV). Exclusão liberada em{' '}
                              {dataLimite.toLocaleDateString('pt-BR')}.
                            </TooltipContent>
                          </Tooltip>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lista.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma evidência anexada ainda.</p>
      )}

      {/* Upload */}
      {podeEditar && (
        <>
          <div className="flex items-center gap-2">
            <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v) }}>
              <SelectTrigger className="w-36">
                <SelectValue>{labelTipo}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIPOS_EVIDENCIA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip,.eml"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Enviando...' : 'Anexar evidência'}
            </Button>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}

          <p className="text-xs text-muted-foreground">
            <Paperclip className="h-3 w-3 inline mr-1" />
            Hash SHA-256 calculado automaticamente. Máximo 50 MB.
          </p>
        </>
      )}

      {!podeEditar && erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  )
}
