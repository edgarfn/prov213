'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BackupCreateModal } from '@/components/backup-create-modal'
import { BackupDownloadModal } from '@/components/backup-download-modal'
import { BackupRestoreModal } from '@/components/backup-restore-modal'
import {
  Database,
  Plus,
  Download,
  Trash2,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { BackupManifest } from '@/lib/backup'

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [downloadTarget, setDownloadTarget] = useState<BackupManifest | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<BackupManifest | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backup')
      const json = await res.json()
      setBackups(json.backups ?? [])
    } catch {
      setError('Não foi possível carregar a lista de backups.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBackups()
  }, [fetchBackups])

  async function handleDelete(filename: string) {
    if (!confirm(`Excluir permanentemente "${filename}"?\n\nEsta ação não pode ser desfeita.`)) {
      return
    }
    setDeleting(filename)
    try {
      const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Erro ao excluir.')
        return
      }
      setBackups((prev) => prev.filter((b) => b.filename !== filename))
      setSuccessMsg('Backup excluído.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backup e Restauração</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Backups completos do banco de dados e evidências — com opção de criptografia AES-256-GCM.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchBackups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo backup
          </Button>
        </div>
      </div>

      {/* Resumo de segurança */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-2xl font-bold text-blue-700">{backups.length}</p>
              <p className="text-blue-600">backups armazenados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">
                {backups.filter((b) => b.encrypted).length}
              </p>
              <p className="text-blue-600">criptografados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">
                {formatBytes(backups.reduce((s, b) => s + b.sizeBytes, 0))}
              </p>
              <p className="text-blue-600">espaço utilizado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMsg && (
        <Alert>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Lista de backups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backups disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
              Carregando…
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>Nenhum backup criado ainda.</p>
              <p className="text-sm mt-1">Crie o primeiro backup para proteger seus dados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((b) => (
                <div
                  key={b.filename}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {/* Ícone de criptografia */}
                  <div className="flex-shrink-0">
                    {b.encrypted ? (
                      <ShieldCheck className="h-8 w-8 text-green-600" />
                    ) : (
                      <ShieldOff className="h-8 w-8 text-amber-500" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-medium truncate">
                        {b.filename}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          b.encrypted
                            ? 'text-green-700 border-green-200 bg-green-50'
                            : 'text-amber-700 border-amber-200 bg-amber-50'
                        }
                      >
                        {b.encrypted ? '🔐 AES-256-GCM' : '🔓 Sem criptografia'}
                      </Badge>
                    </div>

                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>
                        {format(new Date(b.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                      <span>{formatBytes(b.sizeBytes)}</span>
                      <span>
                        {Object.values(b.tables).reduce((s, n) => s + n, 0)} registros
                        · {b.filesCount} arquivo(s)
                      </span>
                    </div>

                    {/* SHA-256 para verificação de integridade */}
                    <p className="font-mono text-xs text-slate-400 mt-0.5 truncate" title={b.sha256Plaintext}>
                      SHA-256: {b.sha256Plaintext.slice(0, 32)}…
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDownloadTarget(b)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Baixar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => setRestoreTarget(b)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(b.filename)}
                      disabled={deleting === b.filename}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota de segurança */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              <p className="font-semibold">Boas práticas de backup (Provimento CNJ 213/2026)</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs opacity-90">
                <li>Armazene backups em local <strong>offsite</strong> ou em nuvem segura (Art. 12)</li>
                <li>Backups criptografados: a frase-senha deve ser guardada separadamente em cofre ou KMS</li>
                <li>Verifique a integridade (SHA-256) periodicamente</li>
                <li>Retenção mínima obrigatória: <strong>5 anos</strong> para evidências (Art. 7º)</li>
                <li>Realize teste de restauração semestral ou anual conforme a classe (Anexo V)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <BackupCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(m) => {
          setBackups((prev) => [m, ...prev])
          setSuccessMsg(`Backup "${m.filename}" criado com sucesso!`)
          setTimeout(() => setSuccessMsg(null), 5000)
        }}
      />

      <BackupDownloadModal
        backup={downloadTarget}
        onClose={() => setDownloadTarget(null)}
      />

      <BackupRestoreModal
        backup={restoreTarget}
        onClose={() => setRestoreTarget(null)}
      />
    </div>
  )
}
