'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { setupMFA, verifyAndEnableMFA } from '@/app/actions/auth'
import { ShieldCheck, ShieldOff, Loader2, QrCode } from 'lucide-react'

interface MFASetupCardProps {
  mfaEnabled: boolean
  mfaVerified: boolean
}

export function MFASetupCard({ mfaEnabled, mfaVerified }: MFASetupCardProps) {
  const [fase, setFase] = useState<'idle' | 'setup' | 'verify'>('idle')
  const [qrData, setQrData] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [ativado, setAtivado] = useState(mfaEnabled && mfaVerified)

  async function iniciarSetup() {
    setLoading(true)
    const result = await setupMFA()
    setLoading(false)
    if (result.error) {
      setMensagem({ tipo: 'erro', texto: result.error })
    } else {
      setQrData(result as { secret: string; otpauthUrl: string })
      setFase('verify')
    }
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await verifyAndEnableMFA(fd)
    setLoading(false)
    if (result.error) {
      setMensagem({ tipo: 'erro', texto: result.error })
    } else {
      setAtivado(true)
      setFase('idle')
      setMensagem({ tipo: 'sucesso', texto: 'MFA ativado com sucesso! Sua conta está mais segura.' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Autenticação em Duas Etapas (MFA)</CardTitle>
          {ativado ? (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-200">
              <ShieldOff className="h-3 w-3 mr-1" />
              Inativo
            </Badge>
          )}
        </div>
        <CardDescription>
          {ativado
            ? 'O MFA está ativo. Ao fazer login, você precisará do código do app autenticador.'
            : 'Ative o MFA para proteger sua conta. O próprio Provimento CNJ 213/2026 exige MFA para acesso a sistemas.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mensagem && (
          <Alert variant={mensagem.tipo === 'erro' ? 'destructive' : 'default'}>
            <AlertDescription>{mensagem.texto}</AlertDescription>
          </Alert>
        )}

        {!ativado && fase === 'idle' && (
          <Button onClick={iniciarSetup} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Ativar MFA
          </Button>
        )}

        {fase === 'verify' && qrData && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-medium">Passo 1: Escaneie o QR Code</p>
              <p className="text-sm text-muted-foreground">
                Abra o Google Authenticator ou Authy e escaneie o QR Code abaixo:
              </p>
              <div className="flex items-center justify-center">
                <div className="border rounded-lg p-4 bg-white">
                  <QrCode className="h-32 w-32 text-slate-400" />
                  <p className="text-xs text-center mt-2 text-muted-foreground">QR Code (use a URL abaixo)</p>
                </div>
              </div>
              <div className="rounded border bg-white p-2">
                <p className="text-xs font-mono break-all text-slate-600">{qrData.otpauthUrl}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ou insira esta chave manualmente: <code className="font-mono">{qrData.secret}</code>
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <p className="text-sm font-medium">Passo 2: Confirme com o código gerado</p>
              <div className="space-y-1">
                <Label htmlFor="code">Código de 6 dígitos</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirmar e ativar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setFase('idle')}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
