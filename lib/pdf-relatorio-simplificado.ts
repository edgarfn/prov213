/**
 * Relatório Simplificado (Anexo IV, item VII) — forma de comprovação
 * dispensada da estrutura ampliada de dossiê técnico, aplicável
 * especialmente às serventias da Classe 1 (Art. 5º, §6º). Gerado por etapa,
 * conforme o item VII, "a": "identificação ... da etapa do Anexo IV a que se
 * refere".
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface RequisitoSimplificadoItem {
  codigo: string
  titulo: string
  descricaoNorma: string
  solucaoAdotada: string | null
  demonstracaoEquivalencia: string | null
  evidenciasNomes: string[]
  status: string
}

export interface RelatorioSimplificadoInput {
  serventiaNome: string
  serventiaCns: string
  classe: string
  etapaNumero: number
  etapaTitulo: string
  requisitos: RequisitoSimplificadoItem[]
  geradoEm: Date
  responsavelNome: string
}

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89

const STATUS_LABEL: Record<string, string> = {
  NAO_INICIADO: 'Não iniciado',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  NAO_APLICAVEL: 'Não aplicável',
}

export async function gerarRelatorioSimplificadoPdf(input: RelatorioSimplificadoInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Relatório Simplificado — ${input.serventiaNome} — Etapa ${input.etapaNumero}`)
  doc.setSubject('Provimento CNJ 213/2026, Anexo IV, item VII')

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

  function paragraph(label: string, value: string, size = 10) {
    ensureSpace(2)
    const text = `${label}: ${value}`
    for (const line of wrapText(text, font, size, PAGE_WIDTH - MARGIN * 2)) {
      ensureSpace(1)
      page.drawText(line, { x: MARGIN, y, size, font })
      y -= size + 3
    }
  }

  // ─── Título ──────────────────────────────────────────────────────────────
  page.drawText('RELATÓRIO SIMPLIFICADO DE IMPLEMENTAÇÃO', { x: MARGIN, y, size: 14, font: bold })
  y -= 16
  page.drawText('Provimento CNJ nº 213/2026 — Anexo IV, item VII', {
    x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4),
  })
  y -= 24

  // ─── a) Identificação ───────────────────────────────────────────────────
  heading('Identificação')
  paragraph('Serventia', `${input.serventiaNome} (CNS ${input.serventiaCns})`)
  paragraph('Classe de enquadramento', input.classe.replace('_', ' '))
  paragraph('Etapa do Anexo IV', `Etapa ${input.etapaNumero} — ${input.etapaTitulo}`)
  paragraph('Gerado em', format(input.geradoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
  y -= 8

  // ─── b, c, d) Requisitos ─────────────────────────────────────────────────
  for (const req of input.requisitos) {
    ensureSpace(3, 16)
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    y -= 14
    heading(`${req.codigo} — ${req.titulo}`)
    paragraph('Status', STATUS_LABEL[req.status] ?? req.status, 9)
    paragraph('Requisito normativo', req.descricaoNorma, 9)
    paragraph('Solução técnica adotada', req.solucaoAdotada?.trim() || 'Não informada', 9)
    paragraph(
      'Demonstração de equivalência funcional',
      req.demonstracaoEquivalencia?.trim() || 'Não informada',
      9,
    )
    paragraph(
      'Evidências disponíveis',
      req.evidenciasNomes.length > 0 ? req.evidenciasNomes.join(', ') : 'Nenhuma evidência anexada',
      9,
    )
    y -= 4
  }

  // ─── e) Declaração de responsabilidade ──────────────────────────────────
  y -= 10
  heading('Declaração de responsabilidade')
  const declaracaoTexto =
    'O titular da delegação, interino ou interventor declara, sob responsabilidade pessoal, a veracidade ' +
    'das informações prestadas neste relatório simplificado e a manutenção das evidências mencionadas pelo ' +
    'prazo mínimo de 5 (cinco) anos, nos termos do art. 5º, §6º, e do Anexo IV, item VII, "e", do Provimento ' +
    'CNJ nº 213/2026.'
  for (const line of wrapText(declaracaoTexto, font, 10, PAGE_WIDTH - MARGIN * 2)) {
    ensureSpace(1)
    page.drawText(line, { x: MARGIN, y, size: 10, font })
    y -= 13
  }
  y -= 30

  ensureSpace(4, 20)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(input.responsavelNome, { x: MARGIN, y: y - 12, size: 9, font })
  page.drawText('Titular / Interino / Interventor', { x: MARGIN, y: y - 24, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

  // ─── Rodapé ──────────────────────────────────────────────────────────────
  const pages = doc.getPages() as PDFPage[]
  pages.forEach((p, i) => {
    p.drawText(
      `Gerado pelo sistema de gestão de conformidade — Provimento CNJ 213/2026 · Página ${i + 1}/${pages.length}`,
      { x: MARGIN, y: 24, size: 7, font, color: rgb(0.55, 0.55, 0.55) },
    )
  })

  return doc.save()
}
