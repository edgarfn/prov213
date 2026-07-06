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
import { ShieldCheck, ShieldOff, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import type { BackupManifest } from '@/lib/backup'
import { useIdleSuspend } from '@/components/idle-session-guard'

interface BackupCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (manifest: BackupManifest) => void
}

export function BackupCreateModal({ open, onClose, onCreated }: BackupCreateModalProps) {
  const { withIdleSuspended } = useIdleSuspend()
  const [encrypt, setEncrypt] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [passphraseConfirm, setPassphraseConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passphraseOk =
    !encrypt || (passphrase.length >= 12 && passphrase === passphraseConfirm)

  async function handleCreate() {
    setError(null)

    if (encrypt && passphrase !== passphraseConfirm) {
      setError('As frases-senha não coincidem.')
      return
    }
    if (encrypt && passphrase.length < 12) {
      setError('Frase-senha mínima de 12 caracteres.')
      return
    }

    setLoading(true)

    try {
      // Coletar+zipar+criptografar todos os dados da serventia pode levar
      // bem mais que alguns segundos — não deve ser interrompido pelo
      // bloqueio por inatividade só porque o usuário está esperando parado.
      const res = await withIdleSuspended(() =>
        fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encrypt, passphrase: encrypt ? passphrase : undefined }),
        }),
      )

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Erro ao criar backup.')
        return
      }

      setPassphrase('')
      setPassphraseConfirm('')
      onCreated(json.manifest as BackupManifest)
      onClose()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setPassphrase('')
    setPassphraseConfirm('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Backup</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opção de criptografia */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEncrypt(true)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${
                encrypt
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <ShieldCheck className="h-6 w-6" />
              <span className="font-medium">Criptografado</span>
              <span className="text-xs text-center opacity-70">
                AES-256-GCM · Recomendado
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEncrypt(false)}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${
                !encrypt
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <ShieldOff className="h-6 w-6" />
              <span className="font-medium">Sem criptografia</span>
              <span className="text-xs text-center opacity-70">
                ZIP simples · Uso interno
              </span>
            </button>
          </div>

          {/* Alerta se sem criptografia */}
          {!encrypt && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Backup sem criptografia contém dados sensíveis em texto claro. Use apenas
                em armazenamento seguro e com acesso restrito.
              </AlertDescription>
            </Alert>
          )}

          {/* Campos de frase-senha */}
          {encrypt && (
            <div className="space-y-3">
              <Alert className="border-blue-200 bg-blue-50">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  <strong>Importante:</strong> A frase-senha não é armazenada. Sem ela,
                  o backup é permanentemente irrecuperável. Guarde-a em local seguro.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="passphrase">Frase-senha (mín. 12 caracteres)</Label>
                <div className="relative">
                  <Input
                    id="passphrase"
                    type={showPass ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Ex: MinhaFraseLonga!2024#"
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPass((p) => !p)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Indicador de força */}
                {passphrase && (
                  <div className="flex gap-1 mt-1">
                    {[12, 16, 20, 28].map((min, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          passphrase.length >= min
                            ? i < 1 ? 'bg-red-400' : i < 2 ? 'bg-amber-400' : i < 3 ? 'bg-blue-400' : 'bg-green-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">
                      {passphrase.length < 12 ? 'Fraca' : passphrase.length < 16 ? 'Mínima' : passphrase.length < 20 ? 'Boa' : 'Forte'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="passphrase-confirm">Confirmar frase-senha</Label>
                <Input
                  id="passphrase-confirm"
                  type={showPass ? 'text' : 'password'}
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  placeholder="Repita a frase-senha"
                  autoComplete="new-password"
                  className={
                    passphraseConfirm && passphraseConfirm !== passphrase
                      ? 'border-red-400'
                      : ''
                  }
                />
                {passphraseConfirm && passphraseConfirm !== passphrase && (
                  <p className="text-xs text-red-600">As frases-senha não coincidem</p>
                )}
              </div>
            </div>
          )}

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
              onClick={handleCreate}
              disabled={loading || !passphraseOk}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando backup…
                </>
              ) : (
                'Criar backup'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
