/**
 * Relatório de Status de Conformidade (spec 5.8) — visão consolidada do
 * cumprimento do Provimento CNJ 213/2026 por uma serventia, destinado à
 * apresentação à Corregedoria competente. Segue o mesmo padrão de seções e
 * helpers de lib/pdf-ata-restauracao.ts.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface EtapaStatusItem {
  numero: number
  titulo: string
  totalRequisitos: number
  concluidos: number
  declarada: boolean
  dataDeclaracao: Date | null
}

export interface StatusConformidadeInput {
  serventiaNome: string
  serventiaCns: string
  classe: string
  subclasse: string | null
  municipio: string
  uf: string
  prazoEtapas12: Date
  prazoConclusaoTotal: Date
  etapas: EtapaStatusItem[]
  incidentesResumo: { total: number; criticosAbertos: number; comunicadosCorregedoria: number }
  vulnerabilidadesResumo: { total: number; vencidas: number; encerradas: number }
  testesRestauracaoResumo: {
    total: number
    ultimaData: Date | null
    ultimaConformidade: string | null
    proximoDevido: Date | null
  }
  totalEvidencias: number
  geradoEm: Date
  geradoPor: string
}

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89

export async function gerarStatusConformidadePdf(input: StatusConformidadeInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Relatório de Status de Conformidade — ${input.serventiaNome}`)
  doc.setSubject('Provimento CNJ 213/2026')

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

  function paragraph(label: string, value: string) {
    ensureSpace(2)
    const text = `${label}: ${value}`
    for (const line of wrapText(text, font, 10, PAGE_WIDTH - MARGIN * 2)) {
      ensureSpace(1)
      page.drawText(line, { x: MARGIN, y, size: 10, font })
      y -= 13
    }
  }

  // ─── Título ──────────────────────────────────────────────────────────────
  page.drawText('RELATÓRIO DE STATUS DE CONFORMIDADE', { x: MARGIN, y, size: 14, font: bold })
  y -= 16
  page.drawText('Provimento CNJ nº 213/2026', { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
  y -= 24

  // ─── 1. Identificação ───────────────────────────────────────────────────
  heading('1. Identificação')
  paragraph('Serventia', `${input.serventiaNome} (CNS ${input.serventiaCns})`)
  paragraph('Município/UF', `${input.municipio}/${input.uf}`)
  paragraph(
    'Classe de enquadramento',
    `${input.classe.replace('_', ' ')}${input.subclasse ? ` — Subclasse ${input.subclasse}` : ''}`,
  )
  paragraph('Gerado em', format(input.geradoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
  paragraph('Gerado por', input.geradoPor)
  y -= 6

  // ─── 2. Prazos legais ────────────────────────────────────────────────────
  heading('2. Prazos legais (Art. 20 e Art. 23)')
  const hoje = new Date()
  paragraph(
    'Prazo das Etapas 1 e 2',
    `${format(input.prazoEtapas12, 'dd/MM/yyyy', { locale: ptBR })} — ${
      hoje > input.prazoEtapas12 ? 'VENCIDO' : 'em curso'
    }`,
  )
  paragraph(
    'Prazo de conclusão total',
    `${format(input.prazoConclusaoTotal, 'dd/MM/yyyy', { locale: ptBR })} — ${
      hoje > input.prazoConclusaoTotal ? 'VENCIDO' : 'em curso'
    }`,
  )
  y -= 6

  // ─── 3. Progresso por etapa ─────────────────────────────────────────────
  heading('3. Progresso por etapa (Anexo IV)')
  for (const etapa of input.etapas) {
    const pct = etapa.totalRequisitos > 0 ? Math.round((etapa.concluidos / etapa.totalRequisitos) * 100) : 0
    paragraph(
      `Etapa ${etapa.numero} — ${etapa.titulo}`,
      `${etapa.concluidos}/${etapa.totalRequisitos} requisitos (${pct}%) — ${
        etapa.declarada
          ? `declarada concluída em ${format(etapa.dataDeclaracao!, 'dd/MM/yyyy', { locale: ptBR })}`
          : 'não declarada'
      }`,
    )
  }
  y -= 6

  // ─── 4. Incidentes de segurança ─────────────────────────────────────────
  heading('4. Incidentes de segurança (Art. 11)')
  paragraph('Total registrado', String(input.incidentesResumo.total))
  paragraph('Críticos ainda em aberto', String(input.incidentesResumo.criticosAbertos))
  paragraph('Comunicados à Corregedoria', String(input.incidentesResumo.comunicadosCorregedoria))
  y -= 6

  // ─── 5. Vulnerabilidades ─────────────────────────────────────────────────
  heading('5. Gestão de vulnerabilidades (Anexo II, item 5)')
  paragraph('Total registrado', String(input.vulnerabilidadesResumo.total))
  paragraph('Com prazo vencido em aberto', String(input.vulnerabilidadesResumo.vencidas))
  paragraph('Encerradas', String(input.vulnerabilidadesResumo.encerradas))
  y -= 6

  // ─── 6. Testes de restauração ────────────────────────────────────────────
  heading('6. Testes de restauração (Anexo V)')
  paragraph('Total realizado', String(input.testesRestauracaoResumo.total))
  paragraph(
    'Último teste',
    input.testesRestauracaoResumo.ultimaData
      ? `${format(input.testesRestauracaoResumo.ultimaData, 'dd/MM/yyyy', { locale: ptBR })} (${
          input.testesRestauracaoResumo.ultimaConformidade ?? 'sem classificação'
        })`
      : 'nenhum teste registrado',
  )
  paragraph(
    'Próximo teste devido',
    input.testesRestauracaoResumo.proximoDevido
      ? format(input.testesRestauracaoResumo.proximoDevido, 'dd/MM/yyyy', { locale: ptBR })
      : 'não aplicável',
  )
  y -= 6

  // ─── 7. Dossiê de evidências ─────────────────────────────────────────────
  heading('7. Dossiê de evidências')
  paragraph('Total de evidências anexadas', String(input.totalEvidencias))
  y -= 10

  // ─── 8. Declaração ───────────────────────────────────────────────────────
  heading('8. Declaração de responsabilidade')
  const declaracaoTexto =
    'O responsável pela serventia declara, sob responsabilidade pessoal e funcional, que as informações ' +
    'consolidadas neste relatório refletem fielmente o estado de implementação do Provimento CNJ nº ' +
    '213/2026 na data de geração indicada, nos termos do art. 17 e do Anexo IV.'
  for (const line of wrapText(declaracaoTexto, font, 10, PAGE_WIDTH - MARGIN * 2)) {
    ensureSpace(1)
    page.drawText(line, { x: MARGIN, y, size: 10, font })
    y -= 13
  }
  y -= 30

  ensureSpace(4, 20)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(input.geradoPor, { x: MARGIN, y: y - 12, size: 9, font })
  page.drawText('Responsável pela serventia', { x: MARGIN, y: y - 24, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

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
