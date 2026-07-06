'use client'

import { useState, useRef, useCallback, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthShell, AuthHeader } from '@/components/auth-shell'
import { ShieldCheck, Loader2, ShieldAlert, KeyRound } from 'lucide-react'

type LoginStep = 'credentials' | 'mfa'

async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify-turnstile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    return !!data.success
  } catch {
    return false
  }
}

function LoginContent({ allowRegistration }: { allowRegistration: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') || '/dashboard'
  const bloqueadaPorInatividade = params.get('motivo') === 'inatividade'

  const [step, setStep] = useState<LoginStep>('credentials')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [mfaCode, setMfaCode] = useState('')

  // Turnstile state — Privacy by Design: token é efêmero, validado server-side
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

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Verificação Turnstile — bloqueia bots antes de tentar autenticar
    if (!turnstileToken) {
      setError('Complete a verificação de segurança antes de continuar.')
      return
    }

    setLoading(true)

    const turnstileOk = await verifyTurnstileToken(turnstileToken)
    if (!turnstileOk) {
      setError('Verificação de segurança falhou. Tente novamente.')
      resetTurnstile()
      setLoading(false)
      return
    }

    const result = await signIn('credentials', {
      email: credentials.email,
      password: credentials.password,
      redirect: false,
    })

    setLoading(false)
    resetTurnstile() // Token de uso único — redefine após cada tentativa

    if (result?.error === 'MFA_REQUIRED') {
      setStep('mfa')
    } else if (result?.error) {
      setError('E-mail ou senha incorretos.')
    } else if (result?.ok) {
      router.push(callbackUrl)
    }
  }

  async function handleMFA(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email: credentials.email,
      password: credentials.password,
      totpCode: mfaCode,
      redirect: false,
    })

    setLoading(false)

    if (result?.error === 'MFA_INVALID') {
      setError('Código MFA inválido. Tente novamente.')
      setMfaCode('')
    } else if (result?.error) {
      setError('Erro na autenticação.')
    } else if (result?.ok) {
      router.push(callbackUrl)
    }
  }

  return (
    <AuthShell>
      {step === 'credentials' ? (
        <AuthHeader
          icon={ShieldCheck}
          title="Entrar"
          description="Acesse sua conta para continuar o acompanhamento de conformidade."
        />
      ) : (
        <AuthHeader
          icon={KeyRound}
          title="Verificação em duas etapas"
          description="Abra o Google Authenticator ou Authy e insira o código de 6 dígitos."
        />
      )}

      {allowRegistration && step === 'credentials' && (
        <Alert className="mb-4 border-blue-100 bg-blue-50 text-blue-800">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Primeiro acesso ao sistema: crie a conta de administrador para começar.
          </AlertDescription>
        </Alert>
      )}

      {bloqueadaPorInatividade && step === 'credentials' && (
        <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-800">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Sua sessão foi encerrada por inatividade. Entre novamente para continuar.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 'credentials' ? (
        <form onSubmit={handleCredentials} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={credentials.email}
              onChange={(e) =>
                setCredentials((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials((p) => ({ ...p, password: e.target.value }))
              }
            />
          </div>

          {/* Cloudflare Turnstile — Privacy by Design
              - Não usa cookies de rastreamento
              - Token efêmero verificado server-side uma única vez
              - 'always' exibe o widget explicitamente para feedback visual claro
          */}
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
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Entrar
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMFA} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa">Código de 6 dígitos</Label>
            <Input
              id="mfa"
              type="text"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              required
              autoFocus
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Verificar
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep('credentials')
              setError(null)
              setMfaCode('')
            }}
          >
            Voltar
          </Button>
        </form>
      )}

      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <Link href="/recuperar-senha" className="text-sm text-blue-600 hover:underline">
          Esqueci minha senha
        </Link>
        {allowRegistration && (
          <p className="text-sm text-muted-foreground">
            Primeiro acesso?{' '}
            <Link href="/registro" className="text-blue-600 hover:underline">
              Criar conta de administrador
            </Link>
          </p>
        )}
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
      </div>
    </AuthShell>
  )
}

export default function LoginForm({ allowRegistration }: { allowRegistration: boolean }) {
  return (
    <Suspense>
      <LoginContent allowRegistration={allowRegistration} />
    </Suspense>
  )
}
