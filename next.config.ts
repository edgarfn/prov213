import type { NextConfig } from 'next'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development'

// Content-Security-Policy — Security by Design
// Turnstile requer: challenges.cloudflare.com (script + connect)
const CSP = [
  "default-src 'self'",
  // scripts: self + Turbopack HMR em dev + Turnstile
  // 'unsafe-inline' é necessário em produção também: o Next.js injeta os
  // dados de hidratação do React via <script>self.__next_f.push(...)</script>
  // inline. Sem nonce por requisição (que forçaria renderização dinâmica em
  // toda a aplicação), 'unsafe-inline' é a abordagem oficialmente documentada
  // para CSP sem nonce — ver node_modules/next/dist/docs/.../content-security-policy.md
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",         // Tailwind inline styles
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Turnstile precisa de connect para validação do challenge
  "connect-src 'self' https://challenges.cloudflare.com",
  // Turnstile carrega iframes do próprio domínio cloudflare
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Impede que a aplicação seja embarcada em iframes externos (clickjacking)
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '0' },            // CSP é mais eficaz que legado XSS-Protection
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // HSTS — apenas em produção (HTTPS)
  ...(!isDev
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Aplica headers de segurança em todas as respostas
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // Força HTTPS em produção
  ...(isDev ? {} : { poweredByHeader: false }),
}

export default nextConfig
