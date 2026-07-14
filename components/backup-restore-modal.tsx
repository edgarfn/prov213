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
import { RotateCcw, Loader2, AlertTriangle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import type { BackupManifest } from '@/lib/backup'
import { useIdleSuspend } from '@/components/idle-session-guard'

const CONFIRM_WORD = 'RESTAURAR'

interface BackupRestoreModalProps {
  backup: BackupManifest | null
  onClose: () => void
}

interface RestoreSummary {
  tables: Record<string, number>
  filesRestored: number
}

export function BackupRestoreModal({ backup, onClose }: BackupRestoreModalProps) {
  const { withIdleSuspended } = useIdleSuspend()
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RestoreSummary | null>(null)

  if (!backup) return null

  const canSubmit = confirmText === CONFIRM_WORD && (!backup.encrypted || passphrase.length > 0)

  function reset() {
    setPassphrase('')
    setConfirmText('')
    setError(null)
    setResult(null)
  }

  async function handleRestore() {
    if (!backup || !canSubmit) return
    setError(null)
    setLoading(true)

    try {
      // Restauração roda uma transação com todas as tabelas da serventia —
      // pode levar minutos em bancos maiores; não deve ser interrompida.
      const res = await withIdleSuspended(() =>
        fetch(`/api/backup/${encodeURIComponent(backup.filename)}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passphrase: backup.encrypted ? passphrase : undefined,
            confirm: true,
          }),
        }),
      )

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Erro ao restaurar backup.')
        return
      }

      setResult(json.summary as RestoreSummary)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    const shouldReload = !!result
    reset()
    onClose()
    // Muitos dados na tela (dashboard, checklists) mudaram — recarrega para refletir o estado restaurado
    if (shouldReload) window.location.reload()
  }

  return (
    <Dialog open={!!backup} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Restaurar Backup
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-800">
                Backup restaurado com sucesso.
              </AlertDescription>
            </Alert>
            <div className="rounded-lg bg-slate-50 border p-3 text-sm space-y-1">
              {Object.entries(result.tables).map(([table, count]) => (
                <div key={table} className="flex justify-between">
                  <span className="text-muted-foreground">{table}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">arquivos</span>
                <span className="font-medium">{result.filesRestored}</span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleClose}>Fechar e recarregar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm space-y-1">
                <p className="font-semibold">Esta ação altera dados existentes.</p>
                <p>
                  Progresso dos requisitos, incidentes, vulnerabilidades, testes de
                  restauração e declarações desta serventia serão revertidos ao
                  instantâneo do backup <strong>{backup.filename}</strong>. Evidências e o
                  log de auditoria nunca são excluídos — apenas registros ausentes são
                  recuperados.
                </p>
              </AlertDescription>
            </Alert>

            {backup.encrypted && (
              <div className="space-y-1.5">
                <Label htmlFor="restore-passphrase">Frase-senha do backup</Label>
                <div className="relative">
                  <Input
                    id="restore-passphrase"
                    type={showPass ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Informe a frase-senha usada na criação"
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPass((p) => !p)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="restore-confirm">
                Digite <strong>{CONFIRM_WORD}</strong> para confirmar
              </Label>
              <Input
                id="restore-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleRestore()}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRestore}
                disabled={loading || !canSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Restaurando…
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restaurar backup
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
