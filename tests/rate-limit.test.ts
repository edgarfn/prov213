import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  tooManyRequestsResponse,
  _resetMemoryStoreForTests,
  type RateLimitRule,
} from '../lib/rate-limit'

// Sem REDIS_URL no ambiente de teste, lib/rate-limit.ts usa o fallback em
// memória automaticamente — nenhum mock de Redis é necessário aqui.

let now = 1_700_000_000_000

beforeEach(() => {
  now = 1_700_000_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  _resetMemoryStoreForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function advance(ms: number) {
  now += ms
}

describe('checkRateLimit (fallback em memória)', () => {
  const rule: RateLimitRule = { bucket: 'test-login', limit: 3, windowMs: 1000, blockMs: 2000 }

  it('permite até `limit` requisições e bloqueia a seguinte', async () => {
    for (let i = 1; i <= rule.limit; i++) {
      const result = await checkRateLimit('1.2.3.4', rule)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(rule.limit - i)
    }

    const blocked = await checkRateLimit('1.2.3.4', rule)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('mantém o bloqueio até `blockMs` expirar, mesmo após o fim da janela original', async () => {
    for (let i = 0; i < rule.limit + 1; i++) {
      await checkRateLimit('9.9.9.9', rule)
    }

    advance((rule.blockMs ?? rule.windowMs) - 1)
    const stillBlocked = await checkRateLimit('9.9.9.9', rule)
    expect(stillBlocked.allowed).toBe(false)

    advance(2)
    const allowedAgain = await checkRateLimit('9.9.9.9', rule)
    expect(allowedAgain.allowed).toBe(true)
    expect(allowedAgain.remaining).toBe(rule.limit - 1)
  })

  it('reseta a contagem naturalmente após `windowMs`, sem ter estourado o limite', async () => {
    const light: RateLimitRule = { bucket: 'reset-natural', limit: 5, windowMs: 1000 }
    await checkRateLimit('8.8.8.8', light)

    advance(1001)
    const result = await checkRateLimit('8.8.8.8', light)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(light.limit - 1)
  })

  it('trata identificadores (IPs) diferentes de forma independente', async () => {
    const isolatedRule: RateLimitRule = { bucket: 'per-ip', limit: 2, windowMs: 1000 }
    await checkRateLimit('ip-a', isolatedRule)
    await checkRateLimit('ip-a', isolatedRule)
    const blockedA = await checkRateLimit('ip-a', isolatedRule)
    expect(blockedA.allowed).toBe(false)

    const allowedB = await checkRateLimit('ip-b', isolatedRule)
    expect(allowedB.allowed).toBe(true)
    expect(allowedB.remaining).toBe(isolatedRule.limit - 1)
  })

  it('trata buckets diferentes de forma independente para o mesmo IP', async () => {
    const loginRule: RateLimitRule = { bucket: 'bucket-login', limit: 1, windowMs: 1000 }
    const forgotRule: RateLimitRule = { bucket: 'bucket-forgot', limit: 1, windowMs: 1000 }

    const first = await checkRateLimit('shared-ip', loginRule)
    expect(first.allowed).toBe(true)
    const secondSameBucket = await checkRateLimit('shared-ip', loginRule)
    expect(secondSameBucket.allowed).toBe(false)

    // Mesmo IP já bloqueado no bucket de login, mas com cota intacta no de forgot-password.
    const otherBucket = await checkRateLimit('shared-ip', forgotRule)
    expect(otherBucket.allowed).toBe(true)
  })
})

describe('rateLimitHeaders', () => {
  const rule: RateLimitRule = { bucket: 'headers-test', limit: 3, windowMs: 60_000 }

  it('inclui X-RateLimit-* sem Retry-After quando permitido', async () => {
    const result = await checkRateLimit('headers-ip', rule)
    const headers = rateLimitHeaders(result)

    expect(headers['X-RateLimit-Limit']).toBe('3')
    expect(headers['X-RateLimit-Remaining']).toBe('2')
    expect(headers['X-RateLimit-Reset']).toBeDefined()
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('inclui Retry-After em segundos quando bloqueado', async () => {
    await checkRateLimit('headers-ip-2', rule)
    await checkRateLimit('headers-ip-2', rule)
    await checkRateLimit('headers-ip-2', rule)
    const blocked = await checkRateLimit('headers-ip-2', rule)

    const headers = rateLimitHeaders(blocked)
    expect(headers['X-RateLimit-Remaining']).toBe('0')
    expect(headers['Retry-After']).toBeDefined()
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0)
  })
})

describe('tooManyRequestsResponse', () => {
  it('retorna HTTP 429 com corpo e headers de rate limit', async () => {
    const rule: RateLimitRule = { bucket: 'response-test', limit: 1, windowMs: 60_000 }
    await checkRateLimit('resp-ip', rule)
    const blocked = await checkRateLimit('resp-ip', rule)

    const response = tooManyRequestsResponse(blocked)
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeTruthy()
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')

    const body = await response.json()
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.retryAfterSeconds).toBeGreaterThan(0)
  })
})

describe('getClientIp', () => {
  it('prioriza CF-Connecting-IP', () => {
    const req = new NextRequest('http://localhost/x', {
      headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
    })
    expect(getClientIp(req)).toBe('1.1.1.1')
  })

  it('usa o primeiro IP de X-Forwarded-For quando não há CF-Connecting-IP', () => {
    const req = new NextRequest('http://localhost/x', {
      headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' },
    })
    expect(getClientIp(req)).toBe('3.3.3.3')
  })

  it('retorna "unknown" quando nenhum header de IP está presente', () => {
    const req = new NextRequest('http://localhost/x')
    expect(getClientIp(req)).toBe('unknown')
  })
})
