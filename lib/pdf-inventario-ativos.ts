/**
 * Inventário Completo de Ativos Tecnológicos — evidência do Requisito 1.7
 * (Anexo I; Anexo IV, Etapa 1, item 1.7: "elaborar inventário completo de
 * ativos tecnológicos, integrações, bancos de dados, certificados digitais,
 * softwares, histórico de atualizações e contratos"). Mesmo padrão de
 * seções e helpers de lib/pdf-status-conformidade.ts.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const TIPO_LABEL: Record<string, string> = {
  EQUIPAMENTO: 'Equipamento',
  SISTEMA_SOFTWARE: 'Sistema/Software',
  BANCO_DADOS: 'Banco de dados',
  INTEGRACAO: 'Integração',
  CERTIFICADO_DIGITAL: 'Certificado digital',
  CONTRATO_FORNECEDOR: 'Contrato de fornecedor',
  OUTRO: 'Outro',
}

const CRITICIDADE_LABEL: Record<string, string> = {
  BAIXO: 'Baixa', MEDIO: 'Média', ALTO: 'Alta', CRITICO: 'Crítica',
}

const STATUS_LABEL: Record<string, string> = {
  EM_AQUISICAO: 'Em aquisição',
  ATIVO: 'Ativo',
  EM_MANUTENCAO: 'Em manutenção',
  DESCONTINUADO: 'Descontinuado',
  BAIXADO: 'Baixado',
}

export interface AtivoInventarioItem {
  nome: string
  tipo: string
  criticidade: string
  status: string
  fabricante: string | null
  modelo: string | null
  numeroSerie: string | null
  identificadorRede: string | null
  localizacao: string | null
  fornecedor: string | null
  descricao: string | null
  contemDadosPessoais: boolean
  versaoAtual: string | null
  dataUltimaAtualizacao: Date | null
  dataAquisicao: Date | null
  dataEntradaProducao: Date | null
  dataFimVidaUtil: Date | null
  dataBaixa: Date | null
  justificativaBaixa: string | null
  responsavelNome: string | null
}

export interface InventarioAtivosInput {
  serventiaNome: string
  serventiaCns: string
  classe: string
  municipio: string
  uf: string
  itens: AtivoInventarioItem[]
  geradoEm: Date
  geradoPor: string
}

const MARGIN = 40
const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89

function dataFmt(d: Date | null): string | null {
  return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : null
}

export async function gerarInventarioAtivosPdf(input: InventarioAtivosInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Inventário Completo de Ativos Tecnológicos — ${input.serventiaNome}`)
  doc.setSubject('Provimento CNJ 213/2026 — Anexo IV, Etapa 1, item 1.7')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function ensureSpace(h = 14) {
    if (y - h < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
  }

  function heading(text: string) {
    ensureSpace(20)
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

  function linha(text: string, size = 9, f: PDFFont = font, color = rgb(0, 0, 0)) {
    for (const line of wrapText(text, f, size, PAGE_WIDTH - MARGIN * 2)) {
      ensureSpace(size + 3)
      page.drawText(line, { x: MARGIN, y, size, font: f, color })
      y -= size + 3
    }
  }

  // ─── Título ──────────────────────────────────────────────────────────────
  page.drawText('INVENTÁRIO COMPLETO DE ATIVOS TECNOLÓGICOS', { x: MARGIN, y, size: 14, font: bold })
  y -= 16
  page.drawText(
    'Provimento CNJ nº 213/2026 — Anexo I; Anexo IV, Etapa 1, item 1.7',
    { x: MARGIN, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) },
  )
  y -= 24

  // ─── 1. Identificação ────────────────────────────────────────────────────
  heading('1. Identificação')
  linha(`Serventia: ${input.serventiaNome} (CNS ${input.serventiaCns})`)
  linha(`Município/UF: ${input.municipio}/${input.uf}`)
  linha(`Classe de enquadramento: ${input.classe.replace('_', ' ')}`)
  linha(`Gerado em: ${format(input.geradoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`)
  linha(`Gerado por: ${input.geradoPor}`)
  y -= 6

  // ─── 2. Resumo ───────────────────────────────────────────────────────────
  heading('2. Resumo')
  linha(`Total de ativos cadastrados: ${input.itens.length}`)

  const porTipo = new Map<string, number>()
  const porStatus = new Map<string, number>()
  for (const item of input.itens) {
    porTipo.set(item.tipo, (porTipo.get(item.tipo) ?? 0) + 1)
    porStatus.set(item.status, (porStatus.get(item.status) ?? 0) + 1)
  }
  linha(
    `Por tipo: ${Array.from(porTipo.entries())
      .map(([tipo, n]) => `${TIPO_LABEL[tipo] ?? tipo} (${n})`)
      .join(' · ')}`,
  )
  linha(
    `Por status: ${Array.from(porStatus.entries())
      .map(([status, n]) => `${STATUS_LABEL[status] ?? status} (${n})`)
      .join(' · ')}`,
  )

  const hoje = new Date()
  const vencidos = input.itens.filter(
    (i) => i.status !== 'BAIXADO' && i.dataFimVidaUtil && i.dataFimVidaUtil < hoje,
  ).length
  if (vencidos > 0) {
    linha(`Ativos com fim de vida útil/suporte vencido: ${vencidos}`, 9, bold, rgb(0.7, 0.1, 0.1))
  }
  y -= 6

  // ─── 3. Detalhamento por ativo ───────────────────────────────────────────
  heading('3. Detalhamento por ativo')

  if (input.itens.length === 0) {
    linha('Nenhum ativo cadastrado até a data de geração deste relatório.', 9, font, rgb(0.4, 0.4, 0.4))
  }

  for (const item of input.itens) {
    ensureSpace(16)
    linha(`${item.nome} — ${TIPO_LABEL[item.tipo] ?? item.tipo}`, 10, bold)
    linha(
      `Criticidade: ${CRITICIDADE_LABEL[item.criticidade] ?? item.criticidade}` +
      ` · Status: ${STATUS_LABEL[item.status] ?? item.status}` +
      (item.contemDadosPessoais ? ' · Armazena dados pessoais' : ''),
    )

    const fabricanteModelo = [item.fabricante, item.modelo].filter(Boolean).join(' ')
    if (fabricanteModelo || item.numeroSerie || item.identificadorRede) {
      linha(
        [
          fabricanteModelo && `Fabricante/modelo: ${fabricanteModelo}`,
          item.numeroSerie && `Nº série/patrimônio: ${item.numeroSerie}`,
          item.identificadorRede && `IP/hostname: ${item.identificadorRede}`,
        ].filter(Boolean).join(' · '),
      )
    }

    if (item.localizacao || item.fornecedor) {
      linha(
        [
          item.localizacao && `Localização: ${item.localizacao}`,
          item.fornecedor && `Fornecedor/terceiro: ${item.fornecedor}`,
        ].filter(Boolean).join(' · '),
      )
    }

    if (item.versaoAtual || item.dataUltimaAtualizacao) {
      linha(
        [
          item.versaoAtual && `Versão atual: ${item.versaoAtual}`,
          dataFmt(item.dataUltimaAtualizacao) && `Última atualização: ${dataFmt(item.dataUltimaAtualizacao)}`,
        ].filter(Boolean).join(' · '),
      )
    }

    const datasCicloVida = [
      dataFmt(item.dataAquisicao) && `Aquisição: ${dataFmt(item.dataAquisicao)}`,
      dataFmt(item.dataEntradaProducao) && `Entrada em produção: ${dataFmt(item.dataEntradaProducao)}`,
      dataFmt(item.dataFimVidaUtil) && `Fim de vida útil/suporte: ${dataFmt(item.dataFimVidaUtil)}`,
    ].filter(Boolean)
    if (datasCicloVida.length > 0) linha(datasCicloVida.join(' · '))

    if (item.status === 'BAIXADO') {
      linha(
        `Baixado em ${dataFmt(item.dataBaixa) ?? '—'}${item.justificativaBaixa ? ` — Justificativa: ${item.justificativaBaixa}` : ''}`,
        9, font, rgb(0.45, 0.45, 0.45),
      )
    }

    if (item.responsavelNome) linha(`Responsável: ${item.responsavelNome}`)
    if (item.descricao) linha(`Descrição: ${item.descricao}`, 8, font, rgb(0.35, 0.35, 0.35))

    y -= 10
  }

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
