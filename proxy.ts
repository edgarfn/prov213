import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { SERVENTIA_COOKIE, IDLE_TIMEOUT_MS } from '@/lib/constants'
import { absoluteUrl } from '@/lib/utils'

const SESSION_COOKIE_NAMES = ['next-auth.session-token', '__Secure-next-auth.session-token']

/** Apaga o cookie de sessão na resposta — usado quando a sessão é considerada
 * expirada por inatividade, para que o navegador não a reenvie em seguida. */
function clearSessionCookies(response: NextResponse) {
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  }
  return response
}

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

export async function proxy(request: NextRequest) {
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

  // 1.1 Bloqueio de sessão por inatividade (Anexo II — "sessão com expiração").
  // O cookie por si só só prova que houve login algum dia; o JWT decodificado
  // carrega lastActivityAt, renovado por heartbeat client-side a cada
  // atividade real (mouse/teclado) — ver components/idle-session-guard.tsx e
  // lib/auth.ts. Um token que falha ao decodificar (adulterado/corrompido) é
  // tratado da mesma forma que inatividade: falha fechado, nunca "passa por
  // via das dúvidas". Isto é reforço server-side — não pode ser contornado
  // apenas desabilitando o JavaScript do cliente.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
  }).catch(() => null)

  const lastActivityAt = typeof token?.lastActivityAt === 'number' ? token.lastActivityAt : null
  const idleExpired = !token || lastActivityAt === null || Date.now() - lastActivityAt > IDLE_TIMEOUT_MS

  if (idleExpired) {
    if (pathname.startsWith('/api/')) {
      return clearSessionCookies(
        withRequestId(
          NextResponse.json(
            { error: 'Sessão expirada por inatividade', code: 'SESSION_IDLE_TIMEOUT' },
            { status: 401 },
          ),
          requestId,
        ),
      )
    }
    const loginUrl = absoluteUrl('/login')
    loginUrl.searchParams.set('callbackUrl', pathname)
    loginUrl.searchParams.set('motivo', 'inatividade')
    return clearSessionCookies(withRequestId(NextResponse.redirect(loginUrl), requestId))
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
