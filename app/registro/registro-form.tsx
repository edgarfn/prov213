'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { registerUser } from '@/app/actions/auth'

export default function RegistroForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Turnstile state — mesma lógica de app/login/login-form.tsx: token
  // efêmero, verificado server-side dentro da própria Server Action.
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!turnstileToken) {
      setError('Complete a verificação de segurança antes de continuar.')
      return
    }

    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirm = formData.get('passwordConfirm') as string

    if (password !== confirm) {
      setError('As senhas não coincidem.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      setLoading(false)
      return
    }

    formData.set('turnstileToken', turnstileToken)
    const result = await registerUser(formData)
    setLoading(false)
    resetTurnstile() // Token de uso único — redefine após cada tentativa

    if (result.error) {
      setError(result.error)
    } else {
      router.push('/login?registered=1')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Criar Conta de Administrador</CardTitle>
          <CardDescription>
            Primeiro acesso ao Copiloto de Conformidade — Provimento CNJ nº 213/2026. Esta conta
            terá privilégios de super-administrador do sistema.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Confirmar senha</Label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
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
              Criar conta
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline ml-1">
              Entrar
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            Protegido por{' '}
            <a
              href="https://www.cloudflare.com/products/turnstile/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Cloudflare Turnstile
            </a>{' '}
            — sem cookies de rastreamento
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
