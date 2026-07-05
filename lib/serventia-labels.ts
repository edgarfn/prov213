/**
 * Rótulos e opções compartilhados entre o onboarding (criação) e a edição
 * de serventia — mesma fonte para não divergir os textos entre as duas telas.
 */
export const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export const CLASSE_LABEL: Record<string, string> = {
  CLASSE_1: 'Classe 1 — Pequeno porte',
  CLASSE_2: 'Classe 2 — Médio porte',
  CLASSE_3: 'Classe 3 — Grande porte',
}

export const TIPO_SOLUCAO_LABEL: Record<string, string> = {
  PROPRIA: 'Própria — TI interna',
  CONTRATADA: 'Contratada — empresa terceirizada',
  COMPARTILHADA: 'Compartilhada — com outras serventias',
  COLETIVA: 'Coletiva — solução conjunta do sistema notarial',
}

export const INFRA_LABEL: Record<string, string> = {
  LOCAL: 'Local — servidores físicos no cartório',
  NUVEM: 'Nuvem — sistemas em cloud',
  HIBRIDA: 'Híbrida — parte local, parte em nuvem',
}
