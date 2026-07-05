'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthShell, AuthHeader } from '@/components/auth-shell'
import { KeyRound, Loader2, ArrowLeft, Mail } from 'lucide-react'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Turnstile state — mesma lógica de app/login/login-form.tsx: token
  // efêmero, verificado server-side dentro da própria rota.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(undefined)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token)
    setTurnstileError(false)
  }, [])

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken(null)
    setTurnstileError(true)
  }, [])

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null)
    turnstileRef.current?.reset()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!turnstileToken) {
      setError('Complete a verificação de segurança antes de continuar.')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken }),
    })

    setLoading(false)
    resetTurnstile() // Token de uso único — redefine após cada tentativa

    if (res.ok) {
      setSent(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Erro ao processar solicitação. Tente novamente.')
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <p className="font-medium text-slate-900">E-mail enviado!</p>
          <p className="text-sm text-muted-foreground">
            Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá
            um link de redefinição em instantes. Verifique também a pasta de spam.
          </p>
          <p className="text-xs text-muted-foreground">
            Sem SMTP configurado? O link aparece no console do servidor.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao login
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <AuthHeader
            icon={KeyRound}
            title="Recuperar senha"
            description="Informe seu e-mail para receber o link de redefinição."
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail cadastrado</Label>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Cloudflare Turnstile — Privacy by Design (mesma lógica do login) */}
            <div className="flex flex-col items-center gap-1">
              {siteKey ? (
                <div className="w-full flex justify-center">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={siteKey}
                    onSuccess={handleTurnstileSuccess}
                    onError={handleTurnstileError}
                    onExpire={resetTurnstile}
                    options={{
                      theme: 'light',
                      language: 'pt-BR',
                      appearance: 'always',
                    }}
                  />
                </div>
              ) : (
                <p className="text-xs text-amber-600 text-center">
                  Configure <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> para ativar a verificação de segurança
                </p>
              )}
              {turnstileError && (
                <p className="text-xs text-red-600">
                  Falha na verificação. Recarregue a página.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || (!!siteKey && !turnstileToken)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar link de recuperação
            </Button>
            <Link href="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao login
              </Button>
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  )
}
