/**
 * Geração do comunicado formal de incidente de segurança — em dois formatos:
 *
 *  - CORREGEDORIA: Art. 11 do Provimento CNJ 213/2026 (prazo de 72h para
 *    incidentes críticos, meta de 24h).
 *  - ANPD: Art. 48 da LGPD e Resolução CD/ANPD nº 15/2024, para incidentes
 *    que envolvam dados pessoais — exige descrição da natureza dos dados,
 *    titulares afetados, medidas de segurança já empregadas e medidas de
 *    mitigação adotadas.
 *
 * Este documento apoia o preenchimento/anexo ao canal oficial de comunicação
 * (Corregedoria local ou peticionamento eletrônico da ANPD) — não substitui
 * o protocolo formal exigido por cada órgão.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type DestinoComunicado = 'CORREGEDORIA' | 'ANPD'

export interface ComunicadoIncidenteInput {
  destino: DestinoComunicado
  serventiaNome: string
  serventiaCns: string
  classe: string
  dpo: string | null
  controladorDados: string | null
  titulo: string
  categoria: string
  gravidade: string
  descricao: string
  dataOcorrencia: Date
  dataCiencia: Date
  prazoLimite: Date | null
  dataComunicacao: Date | null
  causaRaiz: string | null
  medidasCorretivas: string | null
  dadosPessoaisEnvolvidos: boolean
  categoriasDadosAfetados: string | null
  quantidadeTitularesAfetados: number | null
  riscosTitulares: string | null
  responsavelNome: string
}

const MARGIN = 50
const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89

function categoriaLabel(c: string): string {
  const labels: Record<string, string> = {
    ACESSO_NAO_AUTORIZADO: 'Acesso não autorizado',
    MALWARE_RANSOMWARE: 'Malware/Ransomware',
    VAZAMENTO_DADOS: 'Vazamento de dados',
    INDISPONIBILIDADE_DOS: 'Indisponibilidade/Negação de serviço',
    PHISHING_ENGENHARIA_SOCIAL: 'Phishing/Engenharia social',
    FALHA_CONFIGURACAO: 'Falha de configuração',
    PERDA_ROUBO_DISPOSITIVO: 'Perda/roubo de dispositivo',
    FISICO: 'Incidente físico',
    OUTRO: 'Outro',
  }
  return labels[c] ?? c
}

export async function gerarComunicadoIncidentePdf(input: ComunicadoIncidenteInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Comunicado de Incidente — ${input.serventiaNome}`)
  doc.setSubject(
    input.destino === 'CORREGEDORIA'
      ? 'Provimento CNJ 213/2026, Art. 11'
      : 'LGPD, Art. 48 — Resolução CD/ANPD nº 15/2024',
  )

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

  function texto(text: string) {
    for (const line of wrapText(text, font, 10, PAGE_WIDTH - MARGIN * 2)) {
      ensureSpace(1)
      page.drawText(line, { x: MARGIN, y, size: 10, font })
      y -= 13
    }
  }

  // ─── Título ──────────────────────────────────────────────────────────────
  const titulo = input.destino === 'CORREGEDORIA'
    ? 'COMUNICADO DE INCIDENTE DE SEGURANÇA À CORREGEDORIA'
    : 'COMUNICADO DE INCIDENTE DE SEGURANÇA À ANPD (DADOS PESSOAIS)'
  page.drawText(titulo, { x: MARGIN, y, size: 13, font: bold })
  y -= 16
  page.drawText(
    input.destino === 'CORREGEDORIA'
      ? 'Provimento CNJ nº 213/2026 — Art. 11'
      : 'Lei nº 13.709/2018 (LGPD), Art. 48 — Resolução CD/ANPD nº 15/2024',
    { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) },
  )
  y -= 24

  // ─── 1. Identificação ────────────────────────────────────────────────────
  heading('1. Identificação da serventia')
  paragraph('Serventia', `${input.serventiaNome} (CNS ${input.serventiaCns})`)
  paragraph('Classe da serventia', input.classe.replace('_', ' '))
  if (input.destino === 'ANPD') {
    paragraph('Agente de tratamento (controlador)', input.controladorDados || 'Não designado')
    paragraph('Encarregado (DPO)', input.dpo || 'Não designado')
  }
  y -= 6

  // ─── 2. Descrição do incidente ───────────────────────────────────────────
  heading('2. Descrição do incidente')
  paragraph('Título', input.titulo)
  paragraph('Categoria', categoriaLabel(input.categoria))
  paragraph('Gravidade', input.gravidade)
  paragraph('Data de ocorrência', format(input.dataOcorrencia, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
  paragraph('Data de ciência pela serventia', format(input.dataCiencia, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
  y -= 4
  texto(input.descricao)
  y -= 6

  // ─── 3. Prazo e situação de aderência (Corregedoria) ────────────────────
  if (input.destino === 'CORREGEDORIA' && input.prazoLimite) {
    heading('3. Prazo legal de comunicação (Art. 11, §1º — 72h)')
    paragraph('Prazo-limite para comunicação', format(input.prazoLimite, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))
    paragraph(
      'Comunicação efetuada em',
      input.dataComunicacao
        ? format(input.dataComunicacao, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : 'Ainda não efetuada — este documento é preparatório',
    )
    if (input.dataComunicacao && input.dataComunicacao > input.prazoLimite) {
      paragraph(
        'Justificativa pelo atraso',
        input.causaRaiz?.trim() || 'A ser complementada pela serventia antes do envio.',
      )
    }
    y -= 6
  }

  // ─── 3/4. Dados pessoais envolvidos (ANPD) ──────────────────────────────
  if (input.destino === 'ANPD') {
    heading('3. Natureza dos dados pessoais afetados')
    paragraph('Dados pessoais envolvidos', input.dadosPessoaisEnvolvidos ? 'Sim' : 'Não')
    paragraph('Categorias de dados afetados', input.categoriasDadosAfetados?.trim() || 'Não informado')
    paragraph(
      'Quantidade estimada de titulares afetados',
      input.quantidadeTitularesAfetados != null ? String(input.quantidadeTitularesAfetados) : 'Não informado',
    )
    y -= 4

    heading('4. Riscos relacionados ao incidente')
    texto(input.riscosTitulares?.trim() || 'A ser complementado pela serventia antes do envio.')
    y -= 6
  }

  // ─── Causa raiz e medidas ─────────────────────────────────────────────────
  heading(input.destino === 'CORREGEDORIA' ? '4. Causa raiz e medidas corretivas' : '5. Causa raiz e medidas de mitigação')
  paragraph('Causa raiz identificada', input.causaRaiz?.trim() || 'Em apuração')
  paragraph('Medidas corretivas/mitigação adotadas', input.medidasCorretivas?.trim() || 'Em definição')
  y -= 10

  // ─── Declaração ───────────────────────────────────────────────────────────
  heading(input.destino === 'CORREGEDORIA' ? '5. Declaração' : '6. Declaração')
  texto(
    'O responsável pela serventia declara, sob responsabilidade pessoal e funcional, que as informações ' +
    'acima refletem fielmente os fatos apurados até a presente data, comprometendo-se a complementar ou ' +
    'retificar este comunicado caso novos elementos sejam identificados no curso da investigação.',
  )
  y -= 30

  ensureSpace(4, 20)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) })
  page.drawText(input.responsavelNome, { x: MARGIN, y: y - 12, size: 9, font })
  page.drawText('Responsável pela serventia', { x: MARGIN, y: y - 24, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

  // ─── Rodapé ───────────────────────────────────────────────────────────────
  const pages = doc.getPages() as PDFPage[]
  pages.forEach((p, i) => {
    p.drawText(
      `Gerado pelo sistema de gestão de conformidade — Provimento CNJ 213/2026 · Página ${i + 1}/${pages.length}`,
      { x: MARGIN, y: 24, size: 7, font, color: rgb(0.55, 0.55, 0.55) },
    )
  })

  return doc.save()
}
