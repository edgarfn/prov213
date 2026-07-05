import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SERVENTIA_COOKIE } from '@/lib/constants'
import { absoluteUrl } from '@/lib/utils'

// Rotas que exigem apenas autenticação (sem exigir cookie de serventia)
const AUTH_ONLY = [
  '/selecionar-serventia', // agora dentro de (app) mas sem contexto de serventia
  '/onboarding',
  '/alterar-senha',
  '/api/auth/select-serventia',
  '/api/auth/auto-select',
  '/api/auth/change-password',
  '/api/usuario/serventias',
  '/api/usuarios',
]

// Rotas que exigem autenticação + serventia ativa no cookie
const PROTECTED = [
  '/dashboard',
  '/checklists',
  '/evidencias',
  '/configuracoes',
  '/api/backup',
  '/api/auditoria',
  '/api/evidencias',
]

function hasSession(req: NextRequest) {
  return !!(
    req.cookies.get('next-auth.session-token') ||
    req.cookies.get('__Secure-next-auth.session-token')
  )
}

function hasServentiaContext(req: NextRequest) {
  return !!req.cookies.get(SERVENTIA_COOKIE)?.value
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p))
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))

  if (!isAuthOnly && !isProtected) return NextResponse.next()

  // 1. Verificar sessão (autenticação)
  if (!hasSession(request)) {
    const loginUrl = absoluteUrl('/login')
    if (!pathname.startsWith('/api/')) {
      loginUrl.searchParams.set('callbackUrl', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // 2. Rotas auth-only não precisam de serventia
  if (isAuthOnly) return NextResponse.next()

  // 3. Rotas protegidas: verificar contexto de serventia
  if (!hasServentiaContext(request)) {
    // Redireciona para seletor (ou auto-select) — AppLayout resolve o caso de 1 serventia
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Nenhuma serventia selecionada', code: 'NO_SERVENTIA_CONTEXT' },
        { status: 403 },
      )
    }
    return NextResponse.redirect(absoluteUrl('/selecionar-serventia'))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/checklists/:path*',
    '/evidencias/:path*',
    '/configuracoes/:path*',
    '/onboarding/:path*',
    '/alterar-senha',
    '/selecionar-serventia',
    '/api/backup/:path*',
    '/api/auditoria/:path*',
    '/api/evidencias/:path*',
    '/api/usuarios/:path*',
    '/api/usuario/serventias',
    '/api/auth/select-serventia',
    '/api/auth/auto-select',
    '/api/auth/change-password',
  ],
}
