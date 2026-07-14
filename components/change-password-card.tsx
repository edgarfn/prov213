'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react'

export function ChangePasswordCard() {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  function fecharEResetar() {
    setOpen(false)
    setCurrentPassword('')
    setPassword('')
    setConfirm('')
    setShowPass(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMensagem(null)

    if (password.length < 8) {
      setMensagem({ tipo: 'erro', texto: 'A nova senha deve ter pelo menos 8 caracteres.' })
      return
    }
    if (password !== confirm) {
      setMensagem({ tipo: 'erro', texto: 'As senhas não coincidem.' })
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword: password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setMensagem({ tipo: 'erro', texto: data.error ?? 'Erro ao alterar senha.' })
      return
    }

    fecharEResetar()
    setMensagem({ tipo: 'sucesso', texto: 'Senha alterada com sucesso!' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Senha</CardTitle>
        <CardDescription>Altere a senha da sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mensagem && (
          <Alert variant={mensagem.tipo === 'erro' ? 'destructive' : 'default'}>
            <AlertDescription>{mensagem.texto}</AlertDescription>
          </Alert>
        )}

        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <KeyRound className="h-4 w-4 mr-2" />
            Alterar senha
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type={showPass ? 'text' : 'password'}
                required
                autoFocus
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="newPassword">Nova senha (mín. 8 caracteres)</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowPass((p) => !p)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmNewPassword"
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={confirm && confirm !== password ? 'border-red-400' : ''}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="brand" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar nova senha
              </Button>
              <Button type="button" variant="ghost" onClick={fecharEResetar}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
