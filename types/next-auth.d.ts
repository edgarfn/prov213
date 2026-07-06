import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
    mfaEnabled?: boolean
    mfaVerified?: boolean
  }

  interface User {
    mfaEnabled?: boolean
    mfaVerified?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    mfaEnabled?: boolean
    mfaVerified?: boolean
    /** Epoch ms da última atividade real do usuário — bloqueio por inatividade (ver proxy.ts) */
    lastActivityAt?: number
  }
}
