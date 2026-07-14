import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { matchSensitiveAuthRule } from '../proxy'
import { RATE_LIMIT_RULES } from '../lib/rate-limit'

function req(pathname: string, method: string) {
  return new NextRequest(`http://localhost${pathname}`, { method })
}

describe('matchSensitiveAuthRule', () => {
  it('mapeia cada rota sensível ao bucket correto em POST', () => {
    expect(matchSensitiveAuthRule(req('/api/auth/callback/credentials', 'POST'))).toBe(
      RATE_LIMIT_RULES.authLogin,
    )
    expect(matchSensitiveAuthRule(req('/registro', 'POST'))).toBe(RATE_LIMIT_RULES.authRegister)
    expect(matchSensitiveAuthRule(req('/api/auth/forgot-password', 'POST'))).toBe(
      RATE_LIMIT_RULES.authForgotPassword,
    )
    expect(matchSensitiveAuthRule(req('/api/auth/reset-password', 'POST'))).toBe(
      RATE_LIMIT_RULES.authResetPassword,
    )
    expect(matchSensitiveAuthRule(req('/api/auth/change-password', 'POST'))).toBe(
      RATE_LIMIT_RULES.authChangePassword,
    )
  })

  it('ignora métodos que não sejam POST, mesmo em rota sensível', () => {
    expect(matchSensitiveAuthRule(req('/api/auth/callback/credentials', 'GET'))).toBeNull()
    expect(matchSensitiveAuthRule(req('/api/auth/change-password', 'GET'))).toBeNull()
  })

  it('retorna null para rotas não listadas', () => {
    expect(matchSensitiveAuthRule(req('/dashboard', 'POST'))).toBeNull()
    expect(matchSensitiveAuthRule(req('/api/usuarios', 'POST'))).toBeNull()
  })
})
