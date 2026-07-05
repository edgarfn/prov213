/**
 * Lista de hashes do dossiê técnico (Anexo IV, Disposições Gerais, IV, "a"):
 * "geração de hash dos arquivos integrantes do dossiê, com lista de hashes
 * assinada digitalmente pelo responsável pela serventia ou responsável
 * técnico designado".
 *
 * Este sistema não emite assinatura digital ICP-Brasil. Em seu lugar, a
 * "assinatura" é uma atestação criptográfica interna: o hash mestre (SHA-256
 * da concatenação ordenada de todos os hashes individuais) é gravado como
 * evento imutável na cadeia de auditoria (ver lib/audit.ts), vinculando de
 * forma tamper-evident a identidade do responsável, o timestamp e o
 * conteúdo exato da lista exportada. Isso satisfaz o requisito funcional de
 * integridade verificável, mas não substitui certificado digital ICP-Brasil
 * caso a Corregedoria exija esse padrão específico.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createHash } from 'crypto'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface EvidenciaHashItem {
  requisitoCodigo: string
  requisitoTitulo: string
  nomeArquivo: string
  hashSha256: string
  tamanhoBytes: number
  uploadedByNome: string
  uploadedAt: Date
}

export function calcularHashMestre(itens: EvidenciaHashItem[]): string {
  const concatenado = itens
    .slice()
    .sort((a, b) => a.hashSha256.localeCompare(b.hashSha256))
    .map((i) => i.hashSha256)
    .join('')
  return createHash('sha256').update(concatenado).digest('hex')
}

export async function gerarHashListPdf(input: {
  serventiaNome: string
  serventiaCns: string
  classe: string
  itens: EvidenciaHashItem[]
  hashMestre: string
  responsavelNome: string
  responsavelEmail: string
  geradoEm: Date
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)

  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN = 40

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function ensureSpace(h = 14) {
    if (y - h < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  page.drawText('LISTA DE HASHES DO DOSSIÊ TÉCNICO', { x: MARGIN, y, size: 13, font: bold })
  y -= 16
  page.drawText('Provimento CNJ nº 213/2026 — Anexo IV, Disposições Gerais, IV, "a"', { x: MARGIN, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
  y -= 22

  page.drawText(`Serventia: ${input.serventiaNome} (CNS ${input.serventiaCns}) — ${input.classe.replace('_', ' ')}`, { x: MARGIN, y, size: 9, font })
  y -= 13
  page.drawText(`Gerado em: ${format(input.geradoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, { x: MARGIN, y, size: 9, font })
  y -= 13
  page.drawText(`${input.itens.length} arquivo(s) de evidência`, { x: MARGIN, y, size: 9, font })
  y -= 20

  for (const item of input.itens) {
    ensureSpace(40)
    page.drawText(`${item.requisitoCodigo} — ${item.requisitoTitulo}`, { x: MARGIN, y, size: 8, font: bold })
    y -= 11
    page.drawText(item.nomeArquivo, { x: MARGIN, y, size: 8, font })
    y -= 11
    page.drawText(`SHA-256: ${item.hashSha256}`, { x: MARGIN, y, size: 7, font: mono, color: rgb(0.2, 0.2, 0.2) })
    y -= 11
    page.drawText(
      `${(item.tamanhoBytes / 1024).toFixed(1)} KB · enviado por ${item.uploadedByNome} em ${format(item.uploadedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
      { x: MARGIN, y, size: 7, font, color: rgb(0.45, 0.45, 0.45) },
    )
    y -= 16
  }

  ensureSpace(80)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
  y -= 18
  page.drawText('Hash mestre (SHA-256 da concatenação ordenada de todos os hashes acima):', { x: MARGIN, y, size: 9, font: bold })
  y -= 13
  page.drawText(input.hashMestre, { x: MARGIN, y, size: 8, font: mono })
  y -= 20
  page.drawText(
    `Atestado por ${input.responsavelNome} (${input.responsavelEmail}) e vinculado de forma tamper-evident à` +
    ' trilha de auditoria imutável do sistema (cadeia de hash SHA-256).',
    { x: MARGIN, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) },
  )
  y -= 12
  page.drawText(
    'Observação: esta atestação é uma garantia criptográfica interna do sistema, não um certificado ICP-Brasil.',
    { x: MARGIN, y, size: 7, font, color: rgb(0.5, 0.5, 0.5) },
  )

  return doc.save()
}
