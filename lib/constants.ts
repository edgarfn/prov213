/** Cookie HttpOnly que armazena o serventiaId ativo — lido em server actions e proxy */
export const SERVENTIA_COOKIE = 'prov213_serventia'

// ─── Bloqueio de sessão por inatividade (Anexo II — "sessão com expiração") ──
// Ver proxy.ts (aplicação/enforcement server-side) e
// components/idle-session-guard.tsx (detecção de atividade no cliente).

/** Tempo sem clique/tecla/scroll até a sessão ser tratada como expirada. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000

/** Quanto antes do bloqueio o aviso "sua sessão vai expirar" é exibido. */
export const IDLE_WARNING_MS = 60 * 1000

/** Intervalo mínimo entre heartbeats de atividade enviados ao servidor —
 * evita chamar session.update() a cada movimento de mouse. */
export const IDLE_HEARTBEAT_INTERVAL_MS = 60 * 1000
