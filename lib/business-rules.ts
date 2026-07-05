import { addDays, addMonths, addYears, isAfter, isBefore, differenceInDays } from 'date-fns'
import type { ClasseServentia } from '@/app/generated/prisma/enums'
import type { SubclasseServentia } from '@/app/generated/prisma/enums'
import type { ClassificacaoRisco } from '@/app/generated/prisma/enums'

export interface PrazoEtapa {
  etapas12: Date
  conclusaoTotal: Date
}

export function calcularPrazos(
  dataVigencia: Date,
  classe: ClasseServentia,
  prorrogacaoAtiva: boolean = false,
  prorrogacaoNovaData?: Date | null,
): PrazoEtapa {
  const diasEtapas12: Record<ClasseServentia, number> = {
    CLASSE_3: 90,
    CLASSE_2: 150,
    CLASSE_1: 210,
  }
  const mesesConclusao: Record<ClasseServentia, number> = {
    CLASSE_3: 24,
    CLASSE_2: 30,
    CLASSE_1: 36,
  }

  let etapas12 = addDays(dataVigencia, diasEtapas12[classe])
  const conclusaoTotal = addMonths(dataVigencia, mesesConclusao[classe])

  if (prorrogacaoAtiva && prorrogacaoNovaData) {
    etapas12 = prorrogacaoNovaData
  }

  return { etapas12, conclusaoTotal }
}

export interface ParametrosTecnicos {
  rpoHoras: number
  rtoHoras: number
  backupCompletoHoras: number
  internetMbps: number
  testeRestauracaoMeses: number
  pentest: boolean
  pentestMeses: number | null
  retencaoAnos: number
}

export function parametrosPorClasse(classe: ClasseServentia): ParametrosTecnicos {
  const params: Record<ClasseServentia, ParametrosTecnicos> = {
    CLASSE_1: {
      rpoHoras: 24,
      rtoHoras: 24,
      backupCompletoHoras: 72,
      internetMbps: 2,
      testeRestauracaoMeses: 12,
      pentest: false,
      pentestMeses: null,
      retencaoAnos: 5,
    },
    CLASSE_2: {
      rpoHoras: 12,
      rtoHoras: 24,
      backupCompletoHoras: 48,
      internetMbps: 10,
      testeRestauracaoMeses: 12,
      pentest: false,
      pentestMeses: null,
      retencaoAnos: 5,
    },
    CLASSE_3: {
      rpoHoras: 4,
      rtoHoras: 8,
      backupCompletoHoras: 24,
      internetMbps: 50,
      testeRestauracaoMeses: 6,
      pentest: true,
      pentestMeses: 24,
      retencaoAnos: 5,
    },
  }
  return params[classe]
}

/**
 * Art. 7º, IV / seção 6 da spec: evidências (e trilhas de auditoria) não podem
 * ser fisicamente excluídas dentro do prazo mínimo de retenção. Retorna true
 * enquanto a exclusão deve ser bloqueada (dentro do prazo de guarda).
 */
export function evidenciaBloqueadaPorRetencao(
  uploadedAt: Date,
  retencaoAnos: number,
  hoje: Date = new Date(),
): boolean {
  return isBefore(hoje, addYears(uploadedAt, retencaoAnos))
}

/** Data a partir da qual a exclusão de uma evidência deixa de ser bloqueada. */
export function dataLimiteRetencaoEvidencia(uploadedAt: Date, retencaoAnos: number): Date {
  return addYears(uploadedAt, retencaoAnos)
}

export type SemaforoStatus = 'verde' | 'amarelo' | 'vermelho'

export function calcularSemaforo(prazo: Date, hoje: Date = new Date()): SemaforoStatus {
  if (isAfter(hoje, prazo)) return 'vermelho'
  const dias = differenceInDays(prazo, hoje)
  if (dias <= 30) return 'amarelo'
  return 'verde'
}

export function prazoIncidenteCritico(dataCiencia: Date): Date {
  return new Date(dataCiencia.getTime() + 72 * 60 * 60 * 1000)
}

export function prazoVulnerabilidade(dataIdentificacao: Date, exploracaoAtiva: boolean): Date {
  if (exploracaoAtiva) {
    return new Date(dataIdentificacao.getTime() + 72 * 60 * 60 * 1000)
  }
  return addDays(dataIdentificacao, 30)
}

/**
 * Faixas qualitativas do CVSS v3.1 (FIRST.org) — usada só para SUGERIR a
 * classificação de risco a partir de uma pontuação CVSS informada; a
 * classificação final continua sendo uma escolha humana editável, não uma
 * trava automática.
 */
export function classificacaoRiscoPorCvss(score: number): ClassificacaoRisco {
  if (score >= 9.0) return 'CRITICO'
  if (score >= 7.0) return 'ALTO'
  if (score >= 4.0) return 'MEDIO'
  return 'BAIXO'
}

/**
 * Fonte única do cálculo de "próximo teste de restauração devido" (Anexo I,
 * item 5, V). Usada tanto pelo dashboard quanto pela tela de Testes de
 * Restauração — não duplicar este cálculo em componentes.
 */
export function proximoTesteRestauracaoDevido(
  dataUltimoTeste: Date | null,
  periodicidadeMeses: number,
): Date | null {
  if (!dataUltimoTeste) return null
  return addMonths(dataUltimoTeste, periodicidadeMeses)
}

/** Nunca testado (null) conta como atrasado. */
export function testeRestauracaoAtrasado(
  proximoDevido: Date | null,
  hoje: Date = new Date(),
): boolean {
  if (!proximoDevido) return true
  return isAfter(hoje, proximoDevido)
}

/**
 * Tetos de arrecadação semestral por classe (Art. 16, caput).
 * Atualizados anualmente pelo IPCA (Art. 16, §2º) — revisar estes valores
 * a cada publicação do índice pela Corregedoria Nacional de Justiça.
 */
export const LIMITE_CLASSE_1 = 100_000
export const LIMITE_CLASSE_2 = 500_000

/**
 * Art. 16, I–III: Classe 1 "não ultrapasse" o teto (≤); Classe 2 "supere" o teto
 * da Classe 1 e "não exceda" o seu próprio teto; Classe 3 "ultrapasse" o teto da
 * Classe 2. Os limites são, portanto, inclusivos no teto de cada classe.
 */
export function calcularClassePorArrecadacao(arrecadacaoSemestral: number): ClasseServentia {
  if (arrecadacaoSemestral > LIMITE_CLASSE_2) return 'CLASSE_3'
  if (arrecadacaoSemestral > LIMITE_CLASSE_1) return 'CLASSE_2'
  return 'CLASSE_1'
}

/**
 * Art. 16, I–III: subclasses A–J, calculadas em terços (Classes 1 e 2) ou em
 * múltiplos do teto da Classe 2 (Classe 3). Não implementa a regra de
 * consolidação por dois ciclos do §3º (mudança de classe/subclasse por
 * pequena variação) — decisão de reenquadramento fica a cargo da Corregedoria.
 */
export function calcularSubclasse(
  arrecadacaoSemestral: number,
  classe: ClasseServentia,
): SubclasseServentia {
  if (classe === 'CLASSE_1') {
    const terco = LIMITE_CLASSE_1 / 3
    if (arrecadacaoSemestral <= terco) return 'A'
    if (arrecadacaoSemestral <= terco * 2) return 'B'
    return 'C'
  }
  if (classe === 'CLASSE_2') {
    const faixa = LIMITE_CLASSE_2 - LIMITE_CLASSE_1
    const terco = LIMITE_CLASSE_1 + faixa / 3
    const doisTercos = LIMITE_CLASSE_1 + (faixa * 2) / 3
    if (arrecadacaoSemestral <= terco) return 'D'
    if (arrecadacaoSemestral <= doisTercos) return 'E'
    return 'F'
  }
  // CLASSE_3: múltiplos do teto da Classe 2 (R$ 500.000,00)
  if (arrecadacaoSemestral <= LIMITE_CLASSE_2 * 3) return 'G'
  if (arrecadacaoSemestral <= LIMITE_CLASSE_2 * 6) return 'H'
  if (arrecadacaoSemestral <= LIMITE_CLASSE_2 * 12) return 'I'
  return 'J'
}

/**
 * Fonte única da regra de sequencialidade (Anexo IV, Disposições Gerais, II):
 * só se declara a etapa N se a etapa N-1 já foi declarada e todos os
 * requisitos obrigatórios da etapa N estão concluídos/não-aplicáveis.
 *
 * Chamada por `app/actions/progresso.ts` (autoritativa, servidor) e por
 * `components/checklists-client.tsx` (só habilita/desabilita o botão na UI).
 * Nunca duplicar esta lógica em outro lugar.
 */
export function podeDeclaraEtapa(
  etapaNumero: number,
  etapasDeclaradas: number[],
  progressoConcluido: boolean,
): boolean {
  if (!progressoConcluido) return false
  if (etapaNumero === 1) return true
  return etapasDeclaradas.includes(etapaNumero - 1)
}

export function requisitoAplicavel(
  classesAplicaveis: ClasseServentia[],
  classeServentia: ClasseServentia,
): boolean {
  return classesAplicaveis.includes(classeServentia)
}
