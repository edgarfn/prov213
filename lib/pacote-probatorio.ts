/**
 * Pacote Probatório (spec 5.4 / seção "Dossiê técnico / Evidências"): exporta
 * o dossiê de evidências de uma serventia em um único ZIP contendo um índice
 * legível, a lista de hashes assinável (reaproveitando lib/pdf-hashlist.ts) e
 * cópia de cada arquivo de evidência, organizados por etapa/requisito.
 */
import { readFile } from 'fs/promises'
import path from 'path'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import { calcularHashMestre, gerarHashListPdf, type EvidenciaHashItem } from '@/lib/pdf-hashlist'
import { logger } from '@/lib/logger'

const UPLOAD_BASE = path.join(process.cwd(), 'uploads')

export interface PacoteProbatorioOptions {
  serventiaId: string
  responsavelNome: string
  responsavelEmail: string
}

export interface PacoteProbatorioResult {
  zipBuffer: Buffer
  totalArquivos: number
  hashMestre: string
}

export async function gerarPacoteProbatorio(
  opts: PacoteProbatorioOptions,
): Promise<PacoteProbatorioResult> {
  const evidencias = await db.evidencia.findMany({
    where: { deletedAt: null, progressoRequisito: { serventiaId: opts.serventiaId } },
    orderBy: [{ progressoRequisito: { requisito: { codigo: 'asc' } } }, { uploadedAt: 'asc' }],
    include: {
      progressoRequisito: {
        include: {
          requisito: { select: { codigo: true, titulo: true, etapa: { select: { numero: true } } } },
        },
      },
    },
  })

  if (evidencias.length === 0) {
    throw new Error('Não há evidências anexadas para exportar')
  }

  const serventia = await db.serventia.findUniqueOrThrow({
    where: { id: opts.serventiaId },
    select: { nome: true, cns: true, classe: true },
  })

  const uploaderIds = [...new Set(evidencias.map((e) => e.uploadedBy))]
  const uploaders = await db.user.findMany({
    where: { id: { in: uploaderIds } },
    select: { id: true, name: true, email: true },
  })
  const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name ?? u.email]))

  const itens: EvidenciaHashItem[] = evidencias.map((e) => ({
    // Filtro da query (where: { progressoRequisito: { serventiaId } }) garante que
    // toda evidência retornada aqui tem progressoRequisito não-nulo.
    requisitoCodigo: e.progressoRequisito!.requisito.codigo,
    requisitoTitulo: e.progressoRequisito!.requisito.titulo,
    nomeArquivo: e.nomeArquivo,
    hashSha256: e.hashSha256,
    tamanhoBytes: e.tamanhoBytes,
    uploadedByNome: uploaderMap.get(e.uploadedBy) ?? e.uploadedBy,
    uploadedAt: e.uploadedAt,
  }))

  const hashMestre = calcularHashMestre(itens)
  const geradoEm = new Date()

  const hashListPdf = await gerarHashListPdf({
    serventiaNome: serventia.nome,
    serventiaCns: serventia.cns,
    classe: serventia.classe,
    itens,
    hashMestre,
    responsavelNome: opts.responsavelNome,
    responsavelEmail: opts.responsavelEmail,
    geradoEm,
  })

  const indiceLinhas = [
    'ÍNDICE DO PACOTE PROBATÓRIO',
    `Serventia: ${serventia.nome} (CNS ${serventia.cns}) — ${serventia.classe.replace('_', ' ')}`,
    `Gerado em: ${geradoEm.toLocaleString('pt-BR')}`,
    `Hash mestre (SHA-256): ${hashMestre}`,
    `${evidencias.length} arquivo(s) de evidência`,
    '',
    'Etapa | Requisito | Arquivo | SHA-256 | Enviado por | Data',
    '-'.repeat(100),
  ]

  const zip = new JSZip()
  let arquivosIncluidos = 0

  for (const e of evidencias) {
    const etapaNumero = e.progressoRequisito!.requisito.etapa.numero
    const codigo = e.progressoRequisito!.requisito.codigo
    indiceLinhas.push(
      `Etapa ${etapaNumero} | ${codigo} — ${e.progressoRequisito!.requisito.titulo} | ${e.nomeArquivo} | ` +
        `${e.hashSha256} | ${uploaderMap.get(e.uploadedBy) ?? e.uploadedBy} | ${e.uploadedAt.toLocaleString('pt-BR')}`,
    )

    try {
      const conteudo = await readFile(path.join(UPLOAD_BASE, e.storagePath))
      zip.file(`evidencias/etapa-${etapaNumero}/${codigo}/${e.nomeArquivo}`, conteudo)
      arquivosIncluidos++
    } catch (err) {
      // Arquivo físico ausente — mantém a referência no índice (hash preservado
      // no dossiê) sem interromper a geração do pacote, mas isso é um sinal de
      // integridade relevante o suficiente para alertar um operador: um arquivo
      // de evidência referenciado por hash sumiu do disco.
      logger.warn(
        { err, serventiaId: opts.serventiaId, evidenciaId: e.id, storagePath: e.storagePath },
        'Arquivo físico de evidência não encontrado ao gerar o pacote probatório — hash preservado, arquivo ausente',
      )
      indiceLinhas.push(`  [ARQUIVO FÍSICO NÃO ENCONTRADO — hash preservado no dossiê]`)
    }
  }

  zip.file('indice.txt', indiceLinhas.join('\n'))
  zip.file('lista-hashes.pdf', hashListPdf)

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return { zipBuffer, totalArquivos: arquivosIncluidos, hashMestre }
}
