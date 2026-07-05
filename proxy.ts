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

const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Propaga um x-request-id por requisição — para o próprio request (via
 * next/headers dentro de Route Handlers/Server Actions) e para o cliente
 * (útil para correlacionar um erro relatado pelo usuário com os logs do
 * servidor). Se o cliente já enviar o header, ele é preservado (permite
 * correlação ponta a ponta com um proxy/CDN na frente).
 */
function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

function nextWithRequestId(request: NextRequest, requestId: string) {
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set(REQUEST_ID_HEADER, requestId)
  return withRequestId(NextResponse.next({ request: { headers: forwardedHeaders } }), requestId)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()

  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p))
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))

  if (!isAuthOnly && !isProtected) return nextWithRequestId(request, requestId)

  // 1. Verificar sessão (autenticação)
  if (!hasSession(request)) {
    const loginUrl = absoluteUrl('/login')
    if (!pathname.startsWith('/api/')) {
      loginUrl.searchParams.set('callbackUrl', pathname)
    }
    return withRequestId(NextResponse.redirect(loginUrl), requestId)
  }

  // 2. Rotas auth-only não precisam de serventia
  if (isAuthOnly) return nextWithRequestId(request, requestId)

  // 3. Rotas protegidas: verificar contexto de serventia
  if (!hasServentiaContext(request)) {
    // Redireciona para seletor (ou auto-select) — AppLayout resolve o caso de 1 serventia
    if (pathname.startsWith('/api/')) {
      return withRequestId(
        NextResponse.json(
          { error: 'Nenhuma serventia selecionada', code: 'NO_SERVENTIA_CONTEXT' },
          { status: 403 },
        ),
        requestId,
      )
    }
    return withRequestId(NextResponse.redirect(absoluteUrl('/selecionar-serventia')), requestId)
  }

  return nextWithRequestId(request, requestId)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
