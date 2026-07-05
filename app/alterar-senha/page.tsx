'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthShell, AuthHeader } from '@/components/auth-shell'
import { ShieldCheck, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react'

export default function AlterarSenhaPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) { setError('Senha mínima de 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }

    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: password }),
    })
    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erro ao alterar senha.')
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <AuthShell>
      <AuthHeader
        icon={ShieldCheck}
        title="Troque sua senha"
        description="Primeiro acesso — defina uma senha pessoal segura."
        tone="amber"
      />

      <Alert className="mb-4 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Sua conta foi criada com uma senha provisória. Por segurança, defina uma senha
          pessoal antes de continuar.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
              autoComplete="new-password"
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
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Definir nova senha e continuar
        </Button>
      </form>
    </AuthShell>
  )
}
