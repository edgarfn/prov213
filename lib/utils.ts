import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Constrói uma URL absoluta a partir do domínio canônico (NEXTAUTH_URL).
 *
 * Nunca usar `new URL(path, request.url)` para redirects: atrás de um reverse
 * proxy que não repassa o Host original (comportamento padrão do nginx, que
 * envia `Host: $proxy_host`), `request.url` resolve para o endereço interno
 * (ex.: "localhost:3000"), fazendo o usuário ser redirecionado para localhost
 * em produção.
 */
export function absoluteUrl(path: string): URL {
  const base = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  return new URL(path, base)
}
