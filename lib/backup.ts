/**
 * Sistema de backup — Security by Design
 *
 * Estratégia de criptografia:
 *   • Derivação de chave: scrypt (N=32768, r=8, p=1) — resistente a brute-force por GPU
 *   • Cifra: AES-256-GCM — autenticada (detecta tampering)
 *   • Formato binário: [salt(32)] [iv(12)] [authTag(16)] [ciphertext]
 *   • A frase-senha NUNCA é armazenada; sem ela, o backup é irrecuperável
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  createHash,
} from 'crypto'
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import JSZip from 'jszip'
import { db } from '@/lib/db'

// ─── Constantes ───────────────────────────────────────────────────────────────

const BACKUP_DIR = path.join(process.cwd(), 'backups')
const ALGORITHM = 'aes-256-gcm'
const SALT_LEN = 32
const IV_LEN = 12
const AUTH_TAG_LEN = 16
const BACKUP_VERSION = '1.0'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BackupManifest {
  version: string
  createdAt: string
  createdBy: string
  serventiaId?: string
  encrypted: boolean
  encAlgorithm?: string
  tables: Record<string, number>
  filesCount: number
  /** SHA-256 do ZIP plaintext — permite verificar integridade após descriptografia */
  sha256Plaintext: string
  filename: string
  sizeBytes: number
}

export interface CreateBackupOptions {
  serventiaId: string
  userId: string
  userEmail: string
  encrypt: boolean
  passphrase?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function ensureBackupDir() {
  await mkdir(BACKUP_DIR, { recursive: true })
}

function sha256hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

// ─── Criptografia ─────────────────────────────────────────────────────────────

/**
 * Cifra `data` com AES-256-GCM.
 * Retorna: [salt(32)][iv(12)][authTag(16)][ciphertext]
 */
export function encryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)

  // scrypt: N=32768 requer ~32 MB; maxmem=67 MB evita o limite padrão de 32 MB do Node.js
  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 67_108_864 })

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag() // 16 bytes de MAC

  return Buffer.concat([salt, iv, authTag, encrypted])
}

/**
 * Descriptografa buffer no formato produzido por encryptBuffer.
 * Lança se a frase-senha estiver errada (authTag inválido).
 */
export function decryptBuffer(data: Buffer, passphrase: string): Buffer {
  if (data.length < SALT_LEN + IV_LEN + AUTH_TAG_LEN + 1) {
    throw new Error('Arquivo de backup inválido ou corrompido')
  }

  const salt = data.subarray(0, SALT_LEN)
  const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const authTag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + AUTH_TAG_LEN)
  const ciphertext = data.subarray(SALT_LEN + IV_LEN + AUTH_TAG_LEN)

  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 67_108_864 })

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new Error('Frase-senha incorreta ou backup corrompido (autenticação GCM falhou)')
  }
}

// ─── Coleta de dados ──────────────────────────────────────────────────────────

async function collectDbData(serventiaId: string) {
  const [
    serventia,
    membros,
    progressos,
    evidencias,
    incidentes,
    vulnerabilidades,
    testesRestauracao,
    declaracoes,
    prorrogacoes,
    auditLogs,
    etapas,
    requisitos,
  ] = await Promise.all([
    db.serventia.findUnique({ where: { id: serventiaId } }),
    db.membroServentia.findMany({ where: { serventiaId } }),
    db.progressoRequisito.findMany({ where: { serventiaId } }),
    db.evidencia.findMany({
      where: { OR: [{ progressoRequisito: { serventiaId } }, { testeRestauracao: { serventiaId } }] },
    }),
    db.incidente.findMany({ where: { serventiaId } }),
    db.vulnerabilidade.findMany({ where: { serventiaId } }),
    db.testeRestauracao.findMany({ where: { serventiaId } }),
    db.declaracao.findMany({ where: { serventiaId } }),
    db.prorrogacao.findMany({ where: { serventiaId } }),
    db.auditLog.findMany({ where: { serventiaId } }),
    db.etapa.findMany({ orderBy: { numero: 'asc' } }),
    db.requisito.findMany(),
  ])

  return {
    serventia: serventia ? [serventia] : [],
    membros,
    progressos,
    evidencias,
    incidentes,
    vulnerabilidades,
    testesRestauracao,
    declaracoes,
    prorrogacoes,
    auditLogs,
    etapas,
    requisitos,
  }
}

async function collectFiles(
  serventiaId: string,
): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>()
  const uploadsDir = path.join(process.cwd(), 'uploads', serventiaId)

  try {
    const reqDirs = await readdir(uploadsDir)
    for (const reqId of reqDirs) {
      const reqPath = path.join(uploadsDir, reqId)
      const fileNames = await readdir(reqPath)
      for (const fname of fileNames) {
        const fullPath = path.join(reqPath, fname)
        const buf = await readFile(fullPath)
        files.set(`files/${serventiaId}/${reqId}/${fname}`, buf)
      }
    }
  } catch {
    // Sem arquivos ainda — normal
  }

  return files
}

// ─── Criação do backup ────────────────────────────────────────────────────────

export async function createBackup(opts: CreateBackupOptions): Promise<BackupManifest> {
  await ensureBackupDir()

  if (opts.encrypt && !opts.passphrase) {
    throw new Error('Frase-senha obrigatória quando criptografia está ativada')
  }

  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const suffix = opts.encrypt ? '_enc' : ''
  const filename = `backup_${ts}${suffix}.zip`
  const filepath = path.join(BACKUP_DIR, filename)

  // 1. Coletar dados
  const [dbData, fileMap] = await Promise.all([
    collectDbData(opts.serventiaId),
    collectFiles(opts.serventiaId),
  ])

  // 2. Construir ZIP
  const zip = new JSZip()

  const dbFolder = zip.folder('db')!
  const tables: Record<string, number> = {}
  for (const [table, rows] of Object.entries(dbData)) {
    const rowArr = Array.isArray(rows) ? rows : [rows]
    dbFolder.file(`${table}.json`, JSON.stringify(rowArr, null, 2))
    tables[table] = rowArr.filter(Boolean).length
  }

  for (const [zipPath, buf] of fileMap) {
    zip.file(zipPath, buf)
  }

  const zipPlaintext = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // 3. Hash do plaintext (verificação de integridade pós-decrypt)
  const sha256Plaintext = sha256hex(zipPlaintext)

  // 4. Criptografar se necessário
  const finalBuffer = opts.encrypt && opts.passphrase
    ? encryptBuffer(zipPlaintext, opts.passphrase)
    : zipPlaintext

  // 5. Salvar no disco
  await writeFile(filepath, finalBuffer)

  // 6. Gerar e salvar manifesto
  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    createdBy: opts.userEmail,
    serventiaId: opts.serventiaId,
    encrypted: opts.encrypt,
    encAlgorithm: opts.encrypt ? 'AES-256-GCM + scrypt(N=32768)' : undefined,
    tables,
    filesCount: fileMap.size,
    sha256Plaintext,
    filename,
    sizeBytes: finalBuffer.length,
  }

  await writeFile(
    path.join(BACKUP_DIR, `${filename}.manifest.json`),
    JSON.stringify(manifest, null, 2),
  )

  // 7. Registrar no audit log
  await db.auditLog.create({
    data: {
      serventiaId: opts.serventiaId,
      userId: opts.userId,
      acao: 'BACKUP_CRIADO',
      entidade: 'Backup',
      valorNovo: {
        filename,
        encrypted: opts.encrypt,
        sizeBytes: finalBuffer.length,
        sha256Plaintext,
      } as object,
    },
  })

  return manifest
}

// ─── Listagem ─────────────────────────────────────────────────────────────────

export async function listBackups(serventiaId?: string): Promise<BackupManifest[]> {
  await ensureBackupDir()

  try {
    const entries = await readdir(BACKUP_DIR)
    const manifests: BackupManifest[] = []

    for (const entry of entries) {
      if (!entry.endsWith('.manifest.json')) continue
      const content = await readFile(path.join(BACKUP_DIR, entry), 'utf-8')
      const m = JSON.parse(content) as BackupManifest
      if (!serventiaId || m.serventiaId === serventiaId) {
        manifests.push(m)
      }
    }

    return manifests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  } catch {
    return []
  }
}

// ─── Download (plaintext ou descriptografado) ─────────────────────────────────

export async function getBackupPlaintext(
  filename: string,
  passphrase?: string,
): Promise<Buffer> {
  // Sanitiza para evitar path traversal
  const safe = path.basename(filename)
  if (safe !== filename) throw new Error('Nome de arquivo inválido')

  const filepath = path.join(BACKUP_DIR, safe)
  const raw = await readFile(filepath)

  const manifestPath = path.join(BACKUP_DIR, `${safe}.manifest.json`)
  const manifest = JSON.parse(
    await readFile(manifestPath, 'utf-8'),
  ) as BackupManifest

  let plaintext: Buffer
  if (manifest.encrypted) {
    if (!passphrase) throw new Error('Frase-senha necessária para backup criptografado')
    plaintext = decryptBuffer(raw, passphrase)
  } else {
    plaintext = raw
  }

  // Verificar integridade
  const hash = sha256hex(plaintext)
  if (hash !== manifest.sha256Plaintext) {
    throw new Error('Falha de integridade: hash SHA-256 não confere — backup pode estar corrompido')
  }

  return plaintext
}

// ─── Restauração ──────────────────────────────────────────────────────────────

export interface RestoreBackupOptions {
  filename: string
  passphrase?: string
  serventiaId: string
  userId: string
}

export interface RestoreSummary {
  filename: string
  restoredAt: string
  tables: Record<string, number>
  filesRestored: number
}

/** Converte campos de data (string ISO) em `Date` antes de gravar via Prisma */
function withDates<T extends Record<string, unknown>>(obj: T, keys: string[]): T {
  const out: Record<string, unknown> = { ...obj }
  for (const k of keys) {
    if (out[k] != null) out[k] = new Date(out[k] as string)
  }
  return out as T
}

/**
 * Restaura um backup para a serventia atual.
 *
 * Princípios respeitados (mesmos do resto do sistema):
 *  • Evidências e log de auditoria NUNCA são excluídos ou sobrescritos — a
 *    restauração apenas recupera registros ausentes (append-only, retenção de 5 anos).
 *  • Estado operacional (progresso, incidentes, vulnerabilidades, testes de
 *    restauração, declarações) é revertido para o instantâneo do backup.
 *  • Tudo roda em uma única transação: falha parcial não deixa o banco inconsistente.
 */
export async function restoreBackup(opts: RestoreBackupOptions): Promise<RestoreSummary> {
  const plaintext = await getBackupPlaintext(opts.filename, opts.passphrase)

  const zip = await JSZip.loadAsync(plaintext)

  async function readJson<T = Record<string, unknown>>(name: string): Promise<T[]> {
    const f = zip.file(`db/${name}.json`)
    if (!f) return []
    return JSON.parse(await f.async('string')) as T[]
  }

  const [
    serventiaArr,
    progressos,
    evidencias,
    incidentes,
    vulnerabilidades,
    testesRestauracao,
    declaracoes,
    prorrogacoes,
    auditLogs,
  ] = await Promise.all([
    readJson('serventia'),
    readJson('progressos'),
    readJson('evidencias'),
    readJson('incidentes'),
    readJson('vulnerabilidades'),
    readJson('testesRestauracao'),
    readJson('declaracoes'),
    readJson('prorrogacoes'),
    readJson('auditLogs'),
  ])

  const backupServentia = serventiaArr[0] as Record<string, unknown> | undefined
  if (!backupServentia || backupServentia.id !== opts.serventiaId) {
    throw new Error('Este arquivo de backup pertence a outra serventia e não pode ser restaurado aqui')
  }

  const tables: Record<string, number> = {}

  await db.$transaction(async (tx) => {
    // Serventia — atualiza os dados cadastrais (nunca remove o registro)
    const { id, ...serventiaData } = withDates(backupServentia, [
      'dataVigenciaNorma', 'prorrogacaoNovaData', 'createdAt', 'updatedAt',
    ])
    await tx.serventia.update({ where: { id: id as string }, data: serventiaData as never })

    // Progresso dos requisitos — tem Evidencias dependentes (FK RESTRICT), por
    // isso usa upsert em vez de delete+recreate
    for (const raw of progressos) {
      const p = withDates(raw as Record<string, unknown>, ['dataConclusao', 'createdAt', 'updatedAt'])
      const { id: pid, ...data } = p
      await tx.progressoRequisito.upsert({
        where: { id: pid as string },
        create: p as never,
        update: data as never,
      })
    }
    tables.progressos = progressos.length

    // Tabelas sem dependentes — restauração completa (revertida ao instantâneo do backup)
    await tx.incidente.deleteMany({ where: { serventiaId: opts.serventiaId } })
    const incidentesData = incidentes.map((r) =>
      withDates(r as Record<string, unknown>, ['dataOcorrencia', 'dataCiencia', 'dataComunicacao', 'createdAt', 'updatedAt']),
    )
    if (incidentesData.length) await tx.incidente.createMany({ data: incidentesData as never[] })
    tables.incidentes = incidentesData.length

    await tx.vulnerabilidade.deleteMany({ where: { serventiaId: opts.serventiaId } })
    const vulnsData = vulnerabilidades.map((r) =>
      withDates(r as Record<string, unknown>, ['dataIdentificacao', 'prazoLimite', 'dataEncerramento', 'createdAt', 'updatedAt']),
    )
    if (vulnsData.length) await tx.vulnerabilidade.createMany({ data: vulnsData as never[] })
    tables.vulnerabilidades = vulnsData.length

    // Testes de Restauração — podem ter Evidencias dependentes (FK RESTRICT),
    // por isso usa upsert em vez de delete+recreate (mesmo padrão de progressoRequisito)
    for (const raw of testesRestauracao) {
      const t = withDates(raw as Record<string, unknown>, ['dataTeste', 'createdAt', 'updatedAt'])
      const { id: tid, ...data } = t
      await tx.testeRestauracao.upsert({
        where: { id: tid as string },
        create: t as never,
        update: data as never,
      })
    }
    tables.testesRestauracao = testesRestauracao.length

    await tx.declaracao.deleteMany({ where: { serventiaId: opts.serventiaId } })
    const declaracoesData = declaracoes.map((r) =>
      withDates(r as Record<string, unknown>, ['dataDeclaracao']),
    )
    if (declaracoesData.length) await tx.declaracao.createMany({ data: declaracoesData as never[] })

    await tx.prorrogacao.deleteMany({ where: { serventiaId: opts.serventiaId } })
    const prorrogacoesData = prorrogacoes.map((r) =>
      withDates(r as Record<string, unknown>, [
        'dataOriginal', 'dataSolicitada', 'dataSolicitacao', 'dataDecisao', 'createdAt', 'updatedAt',
      ]),
    )
    if (prorrogacoesData.length) await tx.prorrogacao.createMany({ data: prorrogacoesData as never[] })
    tables.prorrogacoes = prorrogacoesData.length
    tables.declaracoes = declaracoesData.length

    // Evidências — nunca excluídas nem sobrescritas; apenas recupera as ausentes
    let evidenciasRestauradas = 0
    for (const raw of evidencias) {
      const e = withDates(raw as Record<string, unknown>, ['uploadedAt', 'deletedAt'])
      const exists = await tx.evidencia.findUnique({ where: { id: e.id as string } })
      if (!exists) {
        await tx.evidencia.create({ data: e as never })
        evidenciasRestauradas++
      }
    }
    tables.evidencias = evidenciasRestauradas

    // Log de auditoria — append-only; apenas recupera entradas ausentes
    let auditLogsRestaurados = 0
    for (const raw of auditLogs) {
      const a = withDates(raw as Record<string, unknown>, ['timestamp'])
      const exists = await tx.auditLog.findUnique({ where: { id: a.id as string } })
      if (!exists) {
        await tx.auditLog.create({ data: a as never })
        auditLogsRestaurados++
      }
    }
    tables.auditLogs = auditLogsRestaurados
  })

  // Arquivos de evidência — restauração aditiva (não remove arquivos atuais)
  let filesRestored = 0
  const filePrefix = `files/${opts.serventiaId}/`
  for (const [zipPath, entry] of Object.entries(zip.files)) {
    if (entry.dir || !zipPath.startsWith(filePrefix)) continue
    const relPath = zipPath.slice('files/'.length)
    const destPath = path.join(process.cwd(), 'uploads', relPath)
    await mkdir(path.dirname(destPath), { recursive: true })
    const buf = await entry.async('nodebuffer')
    await writeFile(destPath, buf)
    filesRestored++
  }

  await db.auditLog.create({
    data: {
      serventiaId: opts.serventiaId,
      userId: opts.userId,
      acao: 'BACKUP_RESTAURADO',
      entidade: 'Backup',
      valorNovo: { filename: opts.filename, tables, filesRestored } as object,
    },
  })

  return {
    filename: opts.filename,
    restoredAt: new Date().toISOString(),
    tables,
    filesRestored,
  }
}

// ─── Exclusão ─────────────────────────────────────────────────────────────────

export async function deleteBackup(
  filename: string,
  userId: string,
  serventiaId: string,
): Promise<void> {
  const safe = path.basename(filename)
  if (safe !== filename) throw new Error('Nome de arquivo inválido')

  await unlink(path.join(BACKUP_DIR, safe)).catch(() => {})
  await unlink(path.join(BACKUP_DIR, `${safe}.manifest.json`)).catch(() => {})

  await db.auditLog.create({
    data: {
      serventiaId,
      userId,
      acao: 'BACKUP_EXCLUIDO',
      entidade: 'Backup',
      valorNovo: { filename: safe } as object,
    },
  })
}
