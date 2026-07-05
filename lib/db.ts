import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
  pgPool: Pool
}

// Usa um Pool singleton para reutilizar conexões entre hot-reloads em dev
function getOrCreatePool(): Pool {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  // Loga erros inesperados do pool sem travar a aplicação
  pool.on('error', (err) => {
    console.error('[DB Pool] Erro inesperado:', err.message)
  })
  globalForPrisma.pgPool = pool
  return pool
}

function createPrismaClient(): PrismaClient {
  const pool = getOrCreatePool()
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
