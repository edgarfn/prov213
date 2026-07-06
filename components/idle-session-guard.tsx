'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { ShieldAlert, Loader2 } from 'lucide-react'
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  IDLE_HEARTBEAT_INTERVAL_MS,
} from '@/lib/constants'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

interface IdleSuspendContextValue {
  /** Sinaliza o início de uma tarefa longa — pausa o bloqueio por inatividade. */
  suspendIdle: () => void
  /** Sinaliza o fim da tarefa longa — reinicia a contagem de inatividade a partir de agora. */
  resumeIdle: () => void
}

const IdleSuspendContext = createContext<IdleSuspendContextValue | null>(null)

/**
 * Para operações longas (gerar backup, restaurar, exportar dossiê, gerar
 * PDF) que podem levar minutos sem nenhum clique/tecla do usuário — sem
 * isso, o bloqueio por inatividade interromperia a tarefa no meio.
 *
 * Uso: await withIdleSuspended(() => fetch(...))
 */
export function useIdleSuspend() {
  const ctx = useContext(IdleSuspendContext)
  if (!ctx) {
    throw new Error('useIdleSuspend deve ser usado dentro de <IdleSessionGuard>')
  }
  const withIdleSuspended = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      ctx.suspendIdle()
      try {
        return await fn()
      } finally {
        ctx.resumeIdle()
      }
    },
    [ctx],
  )
  return { ...ctx, withIdleSuspended }
}

/**
 * Bloqueio de sessão por inatividade (Anexo II — "sessão com expiração").
 *
 * Duas camadas, de propósito:
 *  - Cliente (este componente): detecta a inatividade rapidamente e cobre a
 *    tela + encerra a sessão — feedback imediato, boa UX.
 *  - Servidor (proxy.ts): é quem de fato decide se a sessão está válida, a
 *    partir do heartbeat gravado no JWT. Um usuário não pode "burlar" o
 *    bloqueio desabilitando este componente via devtools — sem heartbeat
 *    recente, o próximo request ao servidor já cai como sessão expirada.
 */
export function IdleSessionGuard({ children }: { children: React.ReactNode }) {
  const { status, update } = useSession()
  const [locked, setLocked] = useState(false)
  const [warning, setWarning] = useState(false)

  // Inicializados em 0 (não Date.now()) para não chamar função impura durante
  // a renderização — o valor real é preenchido no efeito abaixo, ao montar.
  const lastActivityRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const suspendCountRef = useRef(0)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendHeartbeat = useCallback(
    (force = false) => {
      const now = Date.now()
      if (!force && now - lastHeartbeatRef.current < IDLE_HEARTBEAT_INTERVAL_MS) return
      lastHeartbeatRef.current = now
      // Fire-and-forget: heartbeat não deve travar a interação do usuário.
      void update()
    },
    [update],
  )

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    setWarning(false)
    sendHeartbeat()
  }, [sendHeartbeat])

  const suspendIdle = useCallback(() => {
    suspendCountRef.current += 1
    lastActivityRef.current = Date.now()
    sendHeartbeat(true)
    if (!heartbeatTimerRef.current) {
      heartbeatTimerRef.current = setInterval(() => sendHeartbeat(true), IDLE_HEARTBEAT_INTERVAL_MS)
    }
  }, [sendHeartbeat])

  const resumeIdle = useCallback(() => {
    suspendCountRef.current = Math.max(0, suspendCountRef.current - 1)
    // Reinicia a contagem a partir de agora — o usuário não deve ser
    // bloqueado imediatamente só porque não tocou em nada enquanto esperava.
    lastActivityRef.current = Date.now()
    if (suspendCountRef.current === 0 && heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return

    lastActivityRef.current = Date.now()

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, registerActivity, { passive: true })
    }

    const tick = setInterval(() => {
      if (suspendCountRef.current > 0) return // tarefa longa em andamento — não conta como ocioso

      const idleFor = Date.now() - lastActivityRef.current

      if (idleFor >= IDLE_TIMEOUT_MS) {
        setLocked(true)
        clearInterval(tick)
        // Sessão tratada como suspensa de verdade (sign-out real), não
        // apenas uma tela escondida — encerra o JWT e redireciona ao login.
        void signOut({ callbackUrl: '/login?motivo=inatividade' })
        return
      }

      setWarning(idleFor >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS)
    }, 1000)

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, registerActivity)
      }
      clearInterval(tick)
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    }
  }, [status, registerActivity])

  return (
    <IdleSuspendContext.Provider value={{ suspendIdle, resumeIdle }}>
      {children}

      {warning && !locked && (
        <div className="fixed bottom-4 right-4 z-[9998] max-w-sm rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg">
          <p className="text-sm font-medium text-amber-900">
            Sua sessão será encerrada em instantes por inatividade.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Mova o mouse ou pressione uma tecla para continuar conectado.
          </p>
        </div>
      )}

      {locked && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-slate-950/98 backdrop-blur-sm">
          <ShieldAlert className="h-12 w-12 text-amber-400" />
          <p className="text-lg font-semibold text-white">Sessão bloqueada por inatividade</p>
          <p className="max-w-sm text-center text-sm text-slate-300">
            Por segurança, sua sessão foi encerrada após um período sem atividade.
            Redirecionando para o login…
          </p>
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      )}
    </IdleSuspendContext.Provider>
  )
}
