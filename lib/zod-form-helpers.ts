/**
 * Helpers Zod compartilhados por Server Actions que recebem `FormData` cru
 * (via `Object.fromEntries(formData.entries())`), onde todo valor chega como
 * string. Extraídos de app/actions/{incidentes,vulnerabilidades}.ts, que os
 * duplicavam identicamente.
 */
import { z } from 'zod'

/** String opcional; vazio/whitespace vira `undefined` (não sobrescreve o valor salvo). */
export const optionalText = z.string().optional().transform((s) => (s?.trim() ? s.trim() : undefined))

/** Seleção opcional (ex.: picker de usuário); "_none"/vazio vira `undefined` (não envia o campo). */
export const optionalId = z.string().optional().transform((s) => (s?.trim() && s !== '_none' ? s.trim() : undefined))

/**
 * Mesmo que `optionalId`, mas "_none"/vazio vira `null` explícito (limpa a
 * atribuição) — usado em telas de atualização, onde o formulário sempre
 * reenvia o valor atual do campo.
 */
export const clearableId = z.string().optional().transform((s) => (s?.trim() && s !== '_none' ? s.trim() : null))

/**
 * `undefined` quando o campo nem é enviado (atualização parcial não deve
 * resetar o valor já salvo); só vira boolean quando explicitamente enviado.
 *
 * NUNCA usar `z.coerce.boolean()` aqui: o cliente envia a string "false" (via
 * `String(booleano)` no FormData), e `Boolean("false")` é `true` em JS.
 */
export const boolFromString = z.string().optional().transform((s) => (s === undefined ? undefined : s === 'true'))

/** Inteiro não-negativo opcional (ex.: quantidade de titulares afetados). */
export const optionalInt = z.string().optional().transform((s) => {
  if (!s?.trim()) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : undefined
})
