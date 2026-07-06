'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Loader2, Eye, EyeOff } from 'lucide-react'
import type { BackupManifest } from '@/lib/backup'
import { useIdleSuspend } from '@/components/idle-session-guard'

interface BackupDownloadModalProps {
  backup: BackupManifest | null
  onClose: () => void
}

export function BackupDownloadModal({ backup, onClose }: BackupDownloadModalProps) {
  const { withIdleSuspended } = useIdleSuspend()
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!backup) return null

  async function handleDownload() {
    if (!backup) return
    setError(null)

    if (backup.encrypted && !passphrase) {
      setError('Informe a frase-senha para descriptografar.')
      return
    }

    setLoading(true)

    try {
      // Descriptografar + transferir um ZIP grande pode demorar.
      const res = await withIdleSuspended(() =>
        fetch(`/api/backup/${encodeURIComponent(backup.filename)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase: backup.encrypted ? passphrase : undefined }),
        }),
      )

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Erro no download.')
        return
      }

      // Inicia download via blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup.filename.replace('_enc', '')
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setPassphrase('')
      onClose()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!backup} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download do Backup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 border p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arquivo</span>
              <span className="font-mono text-xs">{backup.filename}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Criptografia</span>
              <span>{backup.encrypted ? '🔐 AES-256-GCM' : '🔓 Sem criptografia'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tamanho</span>
              <span>{(backup.sizeBytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SHA-256</span>
              <span className="font-mono text-xs truncate max-w-[160px]" title={backup.sha256Plaintext}>
                {backup.sha256Plaintext.slice(0, 16)}…
              </span>
            </div>
          </div>

          {backup.encrypted && (
            <div className="space-y-1.5">
              <Label htmlFor="dl-passphrase">
                Frase-senha do backup
              </Label>
              <div className="relative">
                <Input
                  id="dl-passphrase"
                  type={showPass ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Informe a frase-senha usada na criação"
                  className="pr-10"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPass((p) => !p)}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                O servidor descriptografa e entrega o ZIP plaintext. A frase-senha não é armazenada.
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleDownload}
              disabled={loading || (backup.encrypted && !passphrase)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {backup.encrypted ? 'Descriptografando…' : 'Baixando…'}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
