/**
 * Geração da Ata de Teste de Restauração no formato do Anexo V do
 * Provimento CNJ 213/2026. O Anexo V, disposição I, admite "formato
 * diverso, desde que contenha, de forma objetiva e verificável, os
 * elementos essenciais" — este gerador segue a estrutura de seções do
 * modelo oficial (identificação, participantes, escopo, RTO/RPO,
 * arquitetura, procedimento, resultados, medidas corretivas, evidências).
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface AtaRestauracaoInput {
  serventiaNome: string
  serventiaCns: string
  classe: string
  dataTeste: Date
  sistemasRestaurados: string[]
  rtoDefinido: number
  rtoAferido: number
  rpoDefinido: number
  rpoAferido: number
  conformidade: 'INTEGRAL' | 'PARCIAL' | 'NAO_CONFORME'
  participantes: Array<{ nome: string; papel: string }>
  arquiteturaBackup: Record<string, unknown> | null
  medidasCorretivas: string | null
  evidencias: Array<{ nomeArquivo: string; hashSha256: string }>
  responsavelServentia: string
}

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89

function conformidadeLabel(c: AtaRestauracaoInput['conformidade']) {
  if (c === 'INTEGRAL') return 'Conformidade integral'
  if (c === 'PARCIAL') return 'Conformidade parcial (com plano corretivo anexo)'
  return 'Não conformidade (com medidas emergenciais adotadas)'
}

export async function gerarAtaRestauracaoPdf(input: AtaRestauracaoInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Ata de Teste de Restauração — ${input.serventiaNome}`)
  doc.setSubject('Provimento CNJ 213/2026, Anexo V')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function ensureSpace(lines: number, lineHeight = 14) {
    if (y - lines * lineHeight < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  function heading(text: string) {
    ensureSpace(2, 20)
    page.drawText(text, { x: MARGIN, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) })
    y -= 18
  }

  function paragraph(label: string, value: string) {
    ensureSpace(2)
    const text = `${label}: ${value}`
    const wrapped = wrapText(text, font, 10, PAGE_WIDTH - MARGIN * 2)
    for (const line of wrapped) {
      ensureSpace(1)
      page.drawText(line, { x: MARGIN, y, size: 10, font })
      y -= 13
    }
  }

  function wrapText(text: string, f: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (f.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    return lines
  }

  // ─── Título ──────────────────────────────────────────────────────────────
  page.drawText('ATA PARA REGISTRO DO TESTE DE RESTAURAÇÃO', {
    x: MARGIN, y, size: 14, font: bold,
  })
  y -= 16
  page.drawText('Provimento CNJ nº 213/2026 — Anexo V', { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
  y -= 24

  // ─── 1. Identificação ───────────────────────────────────────────────────
  heading('1. Identificação')
  paragraph('Serventia', `${input.serventiaNome} (CNS ${input.serventiaCns})`)
  paragraph('Classe da serventia', input.classe.replace('_', ' '))
  paragraph('Data do teste', format(input.dataTeste, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
  paragraph('Responsável pela serventia', input.responsavelServentia)
  y -= 6

  // ─── 2. Participantes ───────────────────────────────────────────────────
  heading('2. Participantes')
  if (input.participantes.length === 0) {
    paragraph('Participantes', 'Não informados')
  } else {
    for (const p of input.participantes) {
      paragraph('—', `${p.nome} (${p.papel})`)
    }
  }
  y -= 6

  // ─── 3. Escopo ───────────────────────────────────────────────────────────
  heading('3. Escopo do teste')
  paragraph('Sistemas/bases restaurados', input.sistemasRestaurados.join(', ') || 'Não informado')
  y -= 6

  // ─── 4. Validação de parâmetros (RTO/RPO) ──────────────────────────────
  heading('4. Validação de parâmetros operacionais (RTO e RPO)')
  paragraph('RTO definido no PCN/PRD', `${input.rtoDefinido}h`)
  paragraph('RTO aferido no teste', `${input.rtoAferido}h`)
  paragraph('Aderência ao RTO', input.rtoAferido <= input.rtoDefinido ? 'Atendido' : 'Não atendido')
  paragraph('RPO definido para a classe', `${input.rpoDefinido}h`)
  paragraph('RPO aferido no teste', `${input.rpoAferido}h`)
  paragraph('Aderência ao RPO', input.rpoAferido <= input.rpoDefinido ? 'Atendido' : 'Não atendido')
  y -= 6

  // ─── 5. Arquitetura de backup ───────────────────────────────────────────
  heading('5. Arquitetura de backup vigente no momento do teste')
  if (input.arquiteturaBackup && Object.keys(input.arquiteturaBackup).length > 0) {
    for (const [k, v] of Object.entries(input.arquiteturaBackup)) {
      paragraph(k, String(v))
    }
  } else {
    paragraph('Arquitetura', 'Não detalhada')
  }
  y -= 6

  // ─── 6. Resultado consolidado ───────────────────────────────────────────
  heading('6. Resultado consolidado')
  paragraph('Classificação de conformidade', conformidadeLabel(input.conformidade))
  y -= 6

  // ─── 7. Medidas corretivas ───────────────────────────────────────────────
  heading('7. Medidas corretivas')
  paragraph(
    'Providências deliberadas',
    input.medidasCorretivas?.trim() ||
      (input.conformidade === 'INTEGRAL' ? 'Não aplicável — conformidade integral' : 'Não informadas'),
  )
  y -= 6

  // ─── 8. Evidências anexadas ──────────────────────────────────────────────
  heading('8. Evidências técnicas anexadas')
  if (input.evidencias.length === 0) {
    paragraph('Evidências', 'Nenhuma evidência anexada a este teste')
  } else {
    for (const e of input.evidencias) {
      paragraph(e.nomeArquivo, `SHA-256: ${e.hashSha256}`)
    }
  }
  y -= 10

  // ─── 9. Declaração ───────────────────────────────────────────────────────
  heading('9. Declaração')
  const declaracaoTexto =
    'O responsável pela serventia declara, sob responsabilidade pessoal e funcional, que o teste foi ' +
    'realizado conforme os parâmetros oficiais vigentes e que as informações registradas nesta ata refletem ' +
    'fielmente os resultados obtidos, nos termos do Anexo V do Provimento CNJ 213/2026.'
  for (const line of wrapText(declaracaoTexto, font, 10, PAGE_WIDTH - MARGIN * 2)) {
    ensureSpace(1)
    page.drawText(line, { x: MARGIN, y, size: 10, font })
    y -= 13
  }
  y -= 30

  ensureSpace(4, 20)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(input.responsavelServentia, { x: MARGIN, y: y - 12, size: 9, font })
  page.drawText('Responsável pela serventia', { x: MARGIN, y: y - 24, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

  // ─── Rodapé (todas as páginas) ──────────────────────────────────────────
  const pages = doc.getPages() as PDFPage[]
  pages.forEach((p, i) => {
    p.drawText(
      `Gerado pelo sistema de gestão de conformidade — Provimento CNJ 213/2026 · Página ${i + 1}/${pages.length}`,
      { x: MARGIN, y: 24, size: 7, font, color: rgb(0.55, 0.55, 0.55) },
    )
  })

  return doc.save()
}
