/**
 * Fixtures de dados para os testes E2E — cria/limpa registros diretamente via
 * Prisma (mesmo padrão de tests/integration/isolamento-multitenant.test.ts),
 * evitando depender do fluxo de registro (que só cria o primeiro admin do
 * sistema, uma única vez) para preparar cada cenário de teste.
 *
 * Exige DATABASE_URL apontando para um banco de teste já migrado e semeado.
 */
import 'dotenv/config'
import { PrismaClient } from '../../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { generateSecret, generateSync } from 'otplib'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const prisma = new PrismaClient({ adapter })

export interface TestUserOptions {
  email: string
  password: string
  name?: string
  mfaEnabled?: boolean
}

export async function createTestUser(opts: TestUserOptions) {
  const passwordHash = await bcrypt.hash(opts.password, 12)
  const mfaSecret = opts.mfaEnabled ? generateSecret() : null
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name ?? 'Usuário de Teste',
      passwordHash,
      mfaEnabled: !!opts.mfaEnabled,
      mfaVerified: !!opts.mfaEnabled,
      mfaSecret,
    },
  })
  return { ...user, mfaSecret }
}

/** Gera o código TOTP válido para o momento atual (mesma lógica usada no autenticador). */
export function generateTotpCode(secret: string): string {
  return generateSync({ secret })
}

export interface TestServentiaOptions {
  nome: string
  cns: string
  classe?: 'CLASSE_1' | 'CLASSE_2' | 'CLASSE_3'
  onboardingConcluido?: boolean
}

export async function createTestServentia(opts: TestServentiaOptions) {
  return prisma.serventia.create({
    data: {
      nome: opts.nome,
      cns: opts.cns,
      municipio: 'Município de Teste',
      uf: 'SP',
      classe: opts.classe ?? 'CLASSE_1',
      tipoSolucao: 'PROPRIA',
      infra: 'NUVEM',
      dataVigenciaNorma: new Date('2026-02-20'),
      onboardingConcluido: opts.onboardingConcluido ?? true,
    },
  })
}

export async function linkMembro(userId: string, serventiaId: string, papel: 'TITULAR' | 'RESPONSAVEL_TECNICO' | 'AUDITOR_LEITURA' = 'TITULAR') {
  return prisma.membroServentia.create({ data: { userId, serventiaId, papel } })
}

/** Remove todos os vestígios de uma serventia de teste (ordem segura de FKs). */
export async function cleanupServentia(serventiaId: string) {
  await prisma.evidencia.deleteMany({
    where: { OR: [{ progressoRequisito: { serventiaId } }, { testeRestauracao: { serventiaId } }] },
  })
  await prisma.declaracao.deleteMany({ where: { serventiaId } })
  await prisma.prorrogacao.deleteMany({ where: { serventiaId } })
  await prisma.testeRestauracao.deleteMany({ where: { serventiaId } })
  await prisma.vulnerabilidade.deleteMany({ where: { serventiaId } })
  await prisma.incidente.deleteMany({ where: { serventiaId } })
  await prisma.progressoRequisito.deleteMany({ where: { serventiaId } })
  await prisma.auditLog.deleteMany({ where: { serventiaId } })
  await prisma.membroServentia.deleteMany({ where: { serventiaId } })
  await prisma.serventia.deleteMany({ where: { id: serventiaId } })
}

export async function cleanupUser(userId: string) {
  await prisma.membroServentia.deleteMany({ where: { userId } })
  await prisma.auditLog.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
}
