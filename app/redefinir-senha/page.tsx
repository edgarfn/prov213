'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthShell, AuthHeader } from '@/components/auth-shell'
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react'

function RedefinirSenhaContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) { setError('Token ausente. Use o link do e-mail.'); return }
    if (password.length < 8) { setError('Senha mínima de 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erro ao redefinir.')
    } else {
      setDone(true)
      setTimeout(() => router.replace('/login'), 2500)
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <p className="text-center text-sm text-muted-foreground">
          Link inválido. Solicite um novo e-mail de recuperação.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeader icon={KeyRound} title="Redefinir senha" description="Escolha uma nova senha segura." />

      {done ? (
        <Alert>
          <AlertDescription>
            Senha redefinida! Redirecionando para o login…
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pwd">Nova senha (mín. 8 caracteres)</Label>
            <div className="relative">
              <Input
                id="pwd"
                type={showPass ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowPass(p => !p)}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input
              id="confirm"
              type={showPass ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={confirm && confirm !== password ? 'border-red-400' : ''}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Redefinir senha
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirSenhaContent />
    </Suspense>
  )
}
