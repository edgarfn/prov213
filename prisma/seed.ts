import 'dotenv/config'
import { PrismaClient, type ClasseServentia } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Gera senha provisória segura de 12 chars se não definida em ADMIN_TEMP_PASSWORD
function getTempPassword(): string {
  return process.env.ADMIN_TEMP_PASSWORD ??
    `Prov213@${randomBytes(4).toString('hex').toUpperCase()}`
}

async function main() {
  console.log('Seeding etapas e requisitos do Provimento CNJ 213/2026...')

  // ─── Usuário administrador configurável (opcional, via .env) ───────────────
  //
  // Não há usuário administrador fixo/hardcoded: qualquer conta de acesso
  // exige configuração explícita via ADMIN_EMAIL e gera senha provisória
  // aleatória com troca obrigatória no primeiro acesso (princípio do menor
  // privilégio e vedação a credenciais padrão/backdoor — Anexo II, item 1).

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) {
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })

    if (!existingAdmin) {
      const tempPassword = getTempPassword()
      const passwordHash = await bcrypt.hash(tempPassword, 12)

      await prisma.user.create({
        data: {
          name: 'Administrador',
          email: adminEmail,
          passwordHash,
          isAdmin: true,
          mustChangePassword: true,
        },
      })

      console.log(`✓ Usuário admin criado: ${adminEmail}`)
      console.log(`  Senha provisória: ${tempPassword}`)
      console.log(`  → Troque a senha no primeiro acesso!`)
    } else {
      console.log(`✓ Usuário admin já existe: ${adminEmail}`)
    }
  }


  // ─── Etapas (Anexo IV) ───────────────────────────────────────────────────
  //
  // Títulos, escopo e condições objetivas transcritos do Anexo IV do
  // Provimento CNJ 213/2026. A ordem e a numeração são normativas: a
  // sequencialidade (Anexo IV, Disposições Gerais, I e II) é regra de
  // conformidade, não apenas organização de UI.
  //
  // Cada etapa termina, no texto legal, com um item "Produzir declaração de
  // conclusão da Etapa N... Registrar a conclusão desta Etapa no Sistema
  // Justiça Aberta" (itens 1.9, 2.9, 3.9, 4.9, 5.7). Esse item NÃO é
  // modelado como requisito de checklist: ele é o próprio ato de declarar a
  // etapa, já implementado como fluxo dedicado (ver `declaraConclusaoEtapa`
  // em app/actions/progresso.ts), que só habilita quando 100% dos
  // requisitos obrigatórios da etapa estão concluídos — replicar esse item
  // como um requisito comum criaria uma dependência circular.

  const etapa1 = await prisma.etapa.upsert({
    where: { numero: 1 },
    update: {
      titulo: 'Governança, Estruturação Organizacional e Conformidade Legal',
      escopo: 'Instituir a base normativa, organizacional e documental que viabiliza a conformidade integral com o Provimento, assegurando responsabilidade definida, alinhamento à LGPD, controle formal de acessos e prevenção imediata de vulnerabilidades críticas.',
      condicoesObjetivas: 'Ao final desta etapa, a serventia deverá possuir governança formal instituída, responsabilidades claramente atribuídas, política interna vigente e publicizada, controles mínimos de autenticação implementados, inventário de ativos concluído e base documental apta a demonstrar conformidade inicial em eventual fiscalização correicional.',
    },
    create: {
      numero: 1,
      titulo: 'Governança, Estruturação Organizacional e Conformidade Legal',
      escopo: 'Instituir a base normativa, organizacional e documental que viabiliza a conformidade integral com o Provimento, assegurando responsabilidade definida, alinhamento à LGPD, controle formal de acessos e prevenção imediata de vulnerabilidades críticas.',
      condicoesObjetivas: 'Ao final desta etapa, a serventia deverá possuir governança formal instituída, responsabilidades claramente atribuídas, política interna vigente e publicizada, controles mínimos de autenticação implementados, inventário de ativos concluído e base documental apta a demonstrar conformidade inicial em eventual fiscalização correicional.',
    },
  })

  const etapa2 = await prisma.etapa.upsert({
    where: { numero: 2 },
    update: {
      titulo: 'Infraestrutura e Continuidade Operacional',
      escopo: 'Estruturar a base material que sustenta os sistemas informatizados, garantindo disponibilidade mínima, estabilidade elétrica, segurança física e planejamento formal de continuidade.',
      condicoesObjetivas: 'Ao término desta etapa, a serventia deverá dispor de infraestrutura física adequada, conectividade compatível com sua classe, planos formais de continuidade (PCN e PRD) com RTO e RPO definidos, e capacidade mínima de manter ou restabelecer as operações dentro dos parâmetros normativos.',
    },
    create: {
      numero: 2,
      titulo: 'Infraestrutura e Continuidade Operacional',
      escopo: 'Estruturar a base material que sustenta os sistemas informatizados, garantindo disponibilidade mínima, estabilidade elétrica, segurança física e planejamento formal de continuidade.',
      condicoesObjetivas: 'Ao término desta etapa, a serventia deverá dispor de infraestrutura física adequada, conectividade compatível com sua classe, planos formais de continuidade (PCN e PRD) com RTO e RPO definidos, e capacidade mínima de manter ou restabelecer as operações dentro dos parâmetros normativos.',
    },
  })

  const etapa3 = await prisma.etapa.upsert({
    where: { numero: 3 },
    update: {
      titulo: 'Proteção do Acervo Digital e Resiliência Tecnológica',
      escopo: 'Assegurar integridade, confidencialidade e recuperabilidade do acervo eletrônico, prevenindo perda de dados, interceptação indevida e comprometimento sistêmico. Pressupõe o cumprimento integral e comprovado da Etapa 2 — não pode ser declarada concluída enquanto incompletos os requisitos estruturais de infraestrutura e continuidade operacional. Consolida modelo de segurança em camadas (defesa em profundidade).',
      condicoesObjetivas: 'Ao final desta etapa, todos os dados críticos deverão estar protegidos por criptografia adequada, com rotinas automatizadas de backup proporcional à classe, armazenamento off-site, monitoramento ativo e defesas perimetrais implementadas.',
    },
    create: {
      numero: 3,
      titulo: 'Proteção do Acervo Digital e Resiliência Tecnológica',
      escopo: 'Assegurar integridade, confidencialidade e recuperabilidade do acervo eletrônico, prevenindo perda de dados, interceptação indevida e comprometimento sistêmico. Pressupõe o cumprimento integral e comprovado da Etapa 2 — não pode ser declarada concluída enquanto incompletos os requisitos estruturais de infraestrutura e continuidade operacional. Consolida modelo de segurança em camadas (defesa em profundidade).',
      condicoesObjetivas: 'Ao final desta etapa, todos os dados críticos deverão estar protegidos por criptografia adequada, com rotinas automatizadas de backup proporcional à classe, armazenamento off-site, monitoramento ativo e defesas perimetrais implementadas.',
    },
  })

  const etapa4 = await prisma.etapa.upsert({
    where: { numero: 4 },
    update: {
      titulo: 'Monitoramento, Auditoria e Validação de Controles',
      escopo: 'Consolidar a rastreabilidade, validar empiricamente os controles implementados e instituir modelo preventivo de gestão de riscos.',
      condicoesObjetivas: 'Ao final desta etapa, a serventia deverá possuir trilhas de auditoria íntegras, monitoramento contínuo, gestão formal de vulnerabilidades, testes documentados de restauração e simulações de desastre validadas.',
    },
    create: {
      numero: 4,
      titulo: 'Monitoramento, Auditoria e Validação de Controles',
      escopo: 'Consolidar a rastreabilidade, validar empiricamente os controles implementados e instituir modelo preventivo de gestão de riscos.',
      condicoesObjetivas: 'Ao final desta etapa, a serventia deverá possuir trilhas de auditoria íntegras, monitoramento contínuo, gestão formal de vulnerabilidades, testes documentados de restauração e simulações de desastre validadas.',
    },
  })

  const etapa5 = await prisma.etapa.upsert({
    where: { numero: 5 },
    update: {
      titulo: 'Interoperabilidade, Consolidação e Governança Evolutiva',
      escopo: 'Integrar a serventia ao ecossistema de fiscalização, consolidar as evidências documentais produzidas nas etapas anteriores e institucionalizar processo permanente e contínuo de revisão, aprimoramento e evolução tecnológica — vedada interpretação que restrinja estas obrigações a um momento único ou conclusivo.',
      condicoesObjetivas: 'Ao final desta etapa, a serventia deverá estar plenamente integrada às plataformas de fiscalização, com interoperabilidade técnica assegurada, política revisada periodicamente, capacitação contínua implementada e declaração formal de conformidade realizada.',
    },
    create: {
      numero: 5,
      titulo: 'Interoperabilidade, Consolidação e Governança Evolutiva',
      escopo: 'Integrar a serventia ao ecossistema de fiscalização, consolidar as evidências documentais produzidas nas etapas anteriores e institucionalizar processo permanente e contínuo de revisão, aprimoramento e evolução tecnológica — vedada interpretação que restrinja estas obrigações a um momento único ou conclusivo.',
      condicoesObjetivas: 'Ao final desta etapa, a serventia deverá estar plenamente integrada às plataformas de fiscalização, com interoperabilidade técnica assegurada, política revisada periodicamente, capacitação contínua implementada e declaração formal de conformidade realizada.',
    },
  })

  const etapas = [etapa1, etapa2, etapa3, etapa4, etapa5]
  console.log(`✓ ${etapas.length} etapas criadas/atualizadas`)

  // ─── Requisitos (Anexo IV, itens acionáveis por etapa) ────────────────────
  //
  // classesAplicaveis: por regra geral os itens do Anexo IV valem para as
  // três classes (proporcionalidade fica nos parâmetros, não na
  // aplicabilidade). Restrição de classe só é usada quando o próprio texto
  // normativo explicitamente limita o requisito a uma classe (ex.: pentest
  // — Classe 3 apenas, Anexo II item 6.IV).

  const TODAS: ClasseServentia[] = ['CLASSE_1', 'CLASSE_2', 'CLASSE_3']

  const requisitos: Array<{
    etapaId: string
    codigo: string
    titulo: string
    descricaoNorma: string
    explicacaoLeigo: string
    articuloReferencia: string
    classesAplicaveis: ClasseServentia[]
    parametrosPorClasse?: Record<string, unknown>
    evidenciasExigidas: string[]
    obrigatorio: boolean
    metaExcelencia: boolean
  }> = [
    // ══════════════════ ETAPA 1 — Governança, Estruturação e Conformidade Legal ══════════════════
    {
      etapaId: etapa1.id,
      codigo: '1.1',
      titulo: 'Designação de Responsável Técnico, Controlador de Dados e DPO',
      descricaoNorma: 'Designar formalmente: (I) responsável técnico interno pela implementação; (II) responsável pela serventia como controlador de dados pessoais; (III) encarregado/DPO, quando aplicável.',
      explicacaoLeigo: 'O cartório precisa nomear formalmente, por escrito, três papéis (podem recair sobre a mesma pessoa quando pequeno o porte): quem cuida da parte técnica de TI, quem responde pelos dados pessoais tratados (controlador — normalmente o próprio titular) e o encarregado (DPO), quando exigido pela LGPD. Sem essa designação formal, ninguém tem responsabilidade clara pela conformidade.',
      articuloReferencia: 'Art. 5º; Art. 7º, §2º; Anexo IV, Etapa 1, item 1.1',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Ato de designação do Responsável Técnico', 'Ato de designação do Controlador de Dados', 'Ato de designação do DPO/Encarregado (quando aplicável)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.2',
      titulo: 'Política de Segurança da Informação (elaboração, aprovação e divulgação)',
      descricaoNorma: 'Elaborar, aprovar e divulgar internamente a Política de Segurança da Informação, contemplando integralmente os elementos mínimos do Anexo III e estabelecendo, de forma expressa e estruturada, as diretrizes, objetivos estratégicos, cronogramas, responsabilidades e demais parâmetros que fundamentarão a elaboração, na Etapa 2, do PCN e do PRD. Exige-se nesta etapa a incorporação dessas diretrizes à Política interna, com definição preliminar de escopo, governança e critérios de continuidade — a formalização técnica completa do PCN/PRD (riscos, mitigação, RTO, RPO) ocorre obrigatoriamente na Etapa 2.',
      explicacaoLeigo: 'É preciso escrever, aprovar e divulgar internamente o documento que rege a segurança da informação do cartório (a "Política de Segurança"). Ele deve conter, no mínimo, os itens do Anexo III: governança, controle de acessos, uso aceitável, gestão de incidentes, vulnerabilidades, LGPD, criptografia, gestão de fornecedores e revisão periódica. Nesta etapa basta o esboço de continuidade (quem faz o quê); o plano técnico detalhado de continuidade vem na Etapa 2.',
      articuloReferencia: 'Art. 3º, §1º; Anexo III; Anexo IV, Etapa 1, item 1.2',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Política de Segurança da Informação aprovada e assinada', 'Comprovante de divulgação interna (ata, e-mail, mural)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.3',
      titulo: 'Autenticação Individualizada e MFA para Acessos Administrativos',
      descricaoNorma: 'Implementar autenticação individualizada e autenticação multifator (MFA) obrigatória para acessos administrativos, vedadas credenciais compartilhadas.',
      explicacaoLeigo: 'Cada pessoa deve ter seu próprio usuário e senha — nunca um login "genérico" compartilhado por toda a equipe. E para quem administra sistemas, bancos de dados ou funcionalidades críticas, é obrigatório usar autenticação multifator (MFA): além da senha, uma segunda confirmação (app autenticador, SMS ou similar). Isso garante que, se uma senha vazar, ainda assim ninguém entra sem o segundo fator.',
      articuloReferencia: 'Art. 5º, §2º; Anexo II, item 1; Anexo IV, Etapa 1, item 1.3',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { mfaAdministrativo: 'obrigatório' },
        CLASSE_2: { mfaAdministrativo: 'obrigatório' },
        CLASSE_3: { mfaAdministrativo: 'obrigatório' },
      },
      evidenciasExigidas: ['Print da configuração de MFA no(s) sistema(s)', 'Lista de usuários administrativos com MFA ativo', 'Declaração de vedação a credenciais compartilhadas'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.4',
      titulo: 'Registro das Operações de Tratamento de Dados Pessoais',
      descricaoNorma: 'Instituir registro das operações de tratamento de dados pessoais, nos termos do art. 7º, §1º.',
      explicacaoLeigo: 'A LGPD exige que o cartório mantenha um registro de todas as atividades em que usa dados pessoais: quais dados coleta, para que servem, por quanto tempo ficam guardados e quem tem acesso. Esse registro (às vezes chamado de ROPA) é a base para provar que o tratamento de dados é feito de forma organizada e legal.',
      articuloReferencia: 'Art. 7º, §1º; Anexo IV, Etapa 1, item 1.4',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Registro de operações de tratamento de dados pessoais'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.5',
      titulo: 'Procedimento de Comunicação de Incidentes Críticos à Corregedoria (72h)',
      descricaoNorma: 'Assegurar que incidentes classificados como críticos sejam comunicados à Corregedoria competente nos prazos e condições definidos no Anexo II (até 72 horas), sem prejuízo das comunicações exigidas pela legislação específica.',
      explicacaoLeigo: 'É preciso ter, desde já, um procedimento definido para avisar a Corregedoria quando ocorrer um incidente de segurança grave (ex.: um ataque que derrubou o sistema ou expôs dados). O prazo máximo é de 72 horas contadas da ciência do incidente — não é preciso esperar até a Etapa 3 ou 4 para ter esse procedimento pronto; ele é uma exigência mínima desde o início.',
      articuloReferencia: 'Art. 11, §1º; Anexo II, item 4; Anexo IV, Etapa 1, item 1.5',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { prazoComunicacaoHoras: 72 },
        CLASSE_2: { prazoComunicacaoHoras: 72 },
        CLASSE_3: { prazoComunicacaoHoras: 72 },
      },
      evidenciasExigidas: ['Procedimento de comunicação de incidentes críticos documentado'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.6',
      titulo: 'Meta de Diligência Reforçada — Comunicação em até 24h',
      descricaoNorma: 'Sem prejuízo do prazo máximo de 72 horas, constitui meta de governança e padrão de diligência reforçada que a comunicação à Corregedoria competente ocorra, sempre que possível, em até 24 horas da ciência do incidente, especialmente quando houver risco relevante de indisponibilidade prolongada, comprometimento de dados pessoais ou potencial impacto sistêmico.',
      explicacaoLeigo: 'Além do prazo obrigatório de 72 horas, a norma recomenda como boa prática avisar a Corregedoria em até 24 horas sempre que possível — principalmente em casos mais graves. Não é uma obrigação separada, mas um padrão de excelência que reduz riscos e demonstra diligência do cartório.',
      articuloReferencia: 'Anexo IV, Etapa 1, item 1.6',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Procedimento interno registrando a meta de 24h como padrão de diligência'],
      obrigatorio: false,
      metaExcelencia: true,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.7',
      titulo: 'Inventário Completo de Ativos Tecnológicos',
      descricaoNorma: 'Elaborar inventário completo de ativos tecnológicos, integrações, bancos de dados, certificados digitais, softwares, histórico de atualizações e contratos.',
      explicacaoLeigo: 'É necessário fazer um "cadastro" completo de tudo que o cartório tem em tecnologia: cada computador, servidor, sistema, integração entre sistemas, banco de dados, certificado digital, licença de software e contrato de TI. Sem saber exatamente o que existe, é impossível proteger adequadamente ou provar conformidade numa fiscalização.',
      articuloReferencia: 'Anexo I; Anexo IV, Etapa 1, item 1.7',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Planilha/relatório de inventário de ativos, integrações, bancos de dados, certificados, softwares e contratos'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa1.id,
      codigo: '1.8',
      titulo: 'Regularização de Licenciamento e Revisão de Contratos com Terceiros',
      descricaoNorma: 'Regularizar licenciamento de softwares e revisar todos os contratos com terceiros que envolvam tratamento, armazenamento ou processamento de dados da serventia, assegurando cláusulas expressas e exequíveis de: (i) confidencialidade; (ii) reversibilidade; (iii) portabilidade integral do acervo em formato interoperável e não proprietário; (iv) disponibilização de documentação técnica necessária à migração; (v) cooperação em caso de transição de fornecedor; (vi) gestão de incidentes; e (vii) conformidade integral com a Lei nº 13.709/2018.',
      explicacaoLeigo: 'Todo software usado no cartório precisa ter licença regular (nada de "pirata" ou sem suporte). Além disso, todo contrato com fornecedores de TI que tocam em dados do cartório precisa garantir, por escrito: sigilo, o direito de recuperar tudo se trocar de fornecedor (reversibilidade), o direito de levar os dados num formato aberto (portabilidade), documentação técnica para migração, cooperação do fornecedor numa eventual troca, regras de gestão de incidentes e cumprimento da LGPD. Contrato sem essas cláusulas deixa o cartório "refém" do fornecedor.',
      articuloReferencia: 'Art. 4º, §2º; Art. 6º, III; Art. 15; Anexo IV, Etapa 1, item 1.8',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Comprovantes de licenciamento regular dos softwares em uso', 'Contratos revisados com cláusulas de confidencialidade, reversibilidade, portabilidade e LGPD'],
      obrigatorio: true,
      metaExcelencia: false,
    },

    // ══════════════════ ETAPA 2 — Infraestrutura e Continuidade Operacional ══════════════════
    {
      etapaId: etapa2.id,
      codigo: '2.1',
      titulo: 'Infraestrutura Energética (Fonte Estável, Aterramento e SAI/UPS)',
      descricaoNorma: 'Implementar infraestrutura energética adequada: fonte de energia estável e confiável, sistema de aterramento técnico aferido (com laudo de responsável habilitado) e Sistema de Alimentação Ininterrupta (SAI/UPS) com autonomia suficiente para salvamento de dados e desligamento seguro (safe shutdown), recomendada autonomia estendida de 30 minutos.',
      explicacaoLeigo: 'O cartório precisa de energia estável, um aterramento tecnicamente correto e aferido (com laudo assinado por um profissional habilitado) e um nobreak (UPS) capaz de manter os equipamentos ligados tempo suficiente para salvar o trabalho e desligar tudo corretamente se a luz cair — o ideal é 30 minutos de autonomia.',
      articuloReferencia: 'Art. 12, §8º; Anexo I, item 1; Anexo IV, Etapa 2, item 2.1',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Laudo de aterramento com ART (Anotação de Responsabilidade Técnica)', 'Nota fiscal/contrato do SAI/UPS', 'Teste de autonomia do UPS documentado'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.2',
      titulo: 'Plano de Contingência Energética',
      descricaoNorma: 'Estabelecer plano de contingência energética compatível com a classe da serventia.',
      explicacaoLeigo: 'Além do nobreak para curtas quedas de luz, é preciso ter um plano escrito do que fazer em faltas de energia mais longas: usar gerador, transferir atendimento para outro local, ou outra solução compatível com o porte do cartório.',
      articuloReferencia: 'Anexo I, item 1, IV; Anexo IV, Etapa 2, item 2.2',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Plano de contingência energética documentado'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.3',
      titulo: 'Ambiente Físico com Controle de Acesso e Proteção Estrutural',
      descricaoNorma: 'Adequar o ambiente físico com controle de acesso restrito aos equipamentos críticos e proteção contra incêndios, inundações, variações térmicas e acesso indevido. Quando a infraestrutura for integralmente em nuvem, manter documentação contratual que comprove ou indicie controles equivalentes de segurança física e ambiental pelo fornecedor.',
      explicacaoLeigo: 'O local onde ficam os servidores e equipamentos críticos precisa ter acesso restrito (nem todo mundo pode entrar) e proteção contra incêndio, enchente e variações de temperatura. Se o cartório usa só nuvem, é preciso guardar a documentação do fornecedor que mostra que ele também protege fisicamente os dados.',
      articuloReferencia: 'Anexo I, item 3; Anexo IV, Etapa 2, item 2.3',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Fotos/planta do ambiente com controle de acesso', 'Documentação de proteção contra incêndio/inundação', 'Contrato do provedor de nuvem com controles físicos (se aplicável)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.4',
      titulo: 'Conectividade Compatível com a Classe',
      descricaoNorma: 'Implementar conectividade compatível com a classe, com roteador, comutador (switch) e, quando necessário, múltiplos links ou tecnologia equivalente. As velocidades de referência (Classe 1: 2 Mbps; Classe 2: 10 Mbps; Classe 3: 50 Mbps) têm caráter referencial — considera-se atendido o requisito quando demonstrado, por testes documentados, que a infraestrutura permite concluir o backup incremental e a sincronização de dados dentro do RPO da classe.',
      explicacaoLeigo: 'O cartório precisa de internet com velocidade suficiente para operar, além de roteador e switch para organizar a rede interna. As velocidades de referência (2/10/50 Mbps conforme a classe) são um ponto de partida — o que realmente importa é conseguir concluir os backups dentro do prazo máximo de perda de dados (RPO) exigido para a classe.',
      articuloReferencia: 'Anexo I, item 2; Anexo IV, Etapa 2, item 2.4',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { velocidadeReferenciaMbps: 2 },
        CLASSE_2: { velocidadeReferenciaMbps: 10 },
        CLASSE_3: { velocidadeReferenciaMbps: 50 },
      },
      evidenciasExigidas: ['Contrato com operadora de internet', 'Teste de velocidade ou relatório de cumprimento do RPO via backup incremental'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.5',
      titulo: 'Formalização do PCN e do PRD (Riscos, Mitigação, RTO e RPO)',
      descricaoNorma: 'Formalizar o Plano de Continuidade de Negócios (PCN) e o Plano de Recuperação de Desastres (PRD), em documentos distintos ou integrados, contendo cumulativamente: (I) identificação e avaliação estruturada de riscos; (II) definição objetiva das medidas de mitigação; (III) estabelecimento expresso de RTO e RPO compatíveis com a classe; e (IV) medidas de curto prazo (até 30 dias) e de médio prazo (até 90 dias) para resposta a incidentes e restauração da normalidade — vedada a declaração de conclusão da etapa sem todos esses elementos.',
      explicacaoLeigo: 'O PCN é o "plano B" do cartório (o que fazer se tudo parar) e o PRD é o manual técnico de como recuperar sistemas e dados após um desastre. Juntos, precisam ter: os riscos identificados, o que fazer para reduzi-los, quanto tempo aceita-se ficar parado (RTO) e quanto de dado aceita-se perder (RPO) — de acordo com a classe do cartório — e ações concretas para os primeiros 30 e 90 dias após um incidente.',
      articuloReferencia: 'Art. 3º, §1º e §2º; Anexo II, itens 2.1 e 2.2; Anexo IV, Etapa 2, item 2.5',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { rpoMaximoHoras: 24, rtoMaximoHoras: 24 },
        CLASSE_2: { rpoMaximoHoras: 12, rtoMaximoHoras: 24 },
        CLASSE_3: { rpoMaximoHoras: 4, rtoMaximoHoras: 8 },
      },
      evidenciasExigidas: ['PCN e PRD formalizados e aprovados pelo titular', 'Matriz de riscos e medidas de mitigação', 'RTO e RPO expressamente definidos'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.6',
      titulo: 'Equipamentos Adequados e Suporte Técnico Contínuo',
      descricaoNorma: 'Garantir disponibilidade de equipamentos adequados à operação regular dos sistemas, digitalizadores e impressoras compatíveis com a gestão documental, e suporte técnico próprio ou contratado com atendimento contínuo.',
      explicacaoLeigo: 'O cartório precisa ter computadores, digitalizadores e impressoras em condições adequadas para o volume de trabalho, além de alguém (da própria equipe ou terceirizado) disponível para resolver problemas técnicos quando aparecerem — não pode ficar dias sem suporte se um sistema falhar.',
      articuloReferencia: 'Anexo I, item 6; Anexo IV, Etapa 2, item 2.6',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Inventário de equipamentos em uso', 'Contrato ou designação de suporte técnico com SLA de atendimento'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.7',
      titulo: 'Proteção Básica de Endpoint (Antivírus/Antimalware)',
      descricaoNorma: 'Implementar proteção básica de endpoint (antivírus, antimalware ou solução tecnicamente equivalente) em todas as estações e servidores utilizados pela serventia, como condição mínima de integridade operacional da infraestrutura.',
      explicacaoLeigo: 'Todo computador e servidor do cartório precisa ter um antivírus ativo e atualizado. É a proteção mínima contra vírus e outros programas maliciosos — sem ela, um único computador infectado pode comprometer toda a rede.',
      articuloReferencia: 'Anexo I, item 4, I; Anexo IV, Etapa 2, item 2.7',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Relatório de instalação do antivírus/antimalware', 'Print do painel mostrando todos os dispositivos protegidos'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa2.id,
      codigo: '2.8',
      titulo: 'Documento Técnico Simplificado da Arquitetura Tecnológica',
      descricaoNorma: 'Formalizar documento técnico simplificado da arquitetura tecnológica adotada, contendo, no mínimo: (I) topologia básica de rede; (II) ambientes utilizados (local, nuvem, híbrido, SaaS ou compartilhado); (III) fluxos de dados críticos; (IV) localização física ou lógica dos backups; (V) integrações externas relevantes; e (VI) mecanismos de alta disponibilidade ou redundância.',
      explicacaoLeigo: 'É preciso desenhar e documentar, de forma simples, como a tecnologia do cartório está organizada: como a rede é estruturada, onde os sistemas rodam (local, nuvem, híbrido), por onde os dados críticos passam, onde ficam os backups, quais sistemas externos se conectam ao do cartório e quais mecanismos existem para evitar que tudo pare de funcionar ao mesmo tempo.',
      articuloReferencia: 'Anexo IV, Etapa 2, item 2.8',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Documento técnico simplificado da arquitetura (topologia, ambientes, fluxos, backups, integrações, HA)'],
      obrigatorio: true,
      metaExcelencia: false,
    },

    // ══════════════════ ETAPA 3 — Proteção do Acervo Digital e Resiliência Tecnológica ══════════════════
    {
      etapaId: etapa3.id,
      codigo: '3.1',
      titulo: 'Criptografia em Trânsito e em Repouso com Gestão Formal de Chaves',
      descricaoNorma: 'Implementar criptografia para dados em trânsito e em repouso, inclusive backups, com gestão formal de chaves criptográficas contemplando: inventário atualizado de chaves e certificados; segregação de custódia; controle formal de acesso; política documentada de rotação e renovação periódica; registro das operações de geração, renovação e revogação; e revisão periódica dos padrões adotados.',
      explicacaoLeigo: 'Os dados do cartório precisam estar "embaralhados" (criptografados) tanto quando trafegam pela internet (TLS 1.2 ou superior) quanto quando ficam guardados em disco (padrão equivalente a AES-256), inclusive nos backups. Além disso, as "chaves" que abrem essa criptografia precisam ser controladas com rigor: saber quantas existem, quem pode usá-las, trocá-las periodicamente e registrar cada uso.',
      articuloReferencia: 'Art. 9º; Anexo II, item 2; Anexo IV, Etapa 3, item 3.1',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { criptografiaTransito: 'TLS 1.2+', criptografiaRepouso: 'AES-256 ou equivalente' },
        CLASSE_2: { criptografiaTransito: 'TLS 1.2+', criptografiaRepouso: 'AES-256 ou equivalente' },
        CLASSE_3: { criptografiaTransito: 'TLS 1.2+', criptografiaRepouso: 'AES-256 ou equivalente' },
      },
      evidenciasExigidas: ['Relatório de verificação de TLS (ex.: SSL Labs)', 'Comprovante de criptografia em repouso (BitLocker, LUKS, FileVault ou equivalente)', 'Política de gestão de chaves criptográficas', 'Inventário de chaves e certificados'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.2',
      titulo: 'Rotinas Automatizadas de Backup Completo e Incremental',
      descricaoNorma: 'Implantar rotinas automatizadas de backup completo e incremental: cópias completas em periodicidade compatível com a classe (Classe 3 ≤ 24h; Classe 2 ≤ 48h; Classe 1 ≤ 72h); cópias incrementais compatíveis com o RPO da classe; armazenamento em, no mínimo, dois ambientes tecnicamente independentes com redundância geográfica ou lógica; e garantia de que ao menos um ambiente esteja protegido contra criptografia maliciosa (ransomware), exclusão indevida ou comprometimento simultâneo.',
      explicacaoLeigo: 'O backup precisa ser automático (não depender de alguém lembrar de fazer), com cópia completa em intervalo máximo definido pela classe do cartório e cópias incrementais que respeitem o RPO. E o backup não pode ficar só num lugar: precisa haver pelo menos dois locais independentes (ex.: local + nuvem), sendo que pelo menos um deles protegido contra ataques de ransomware (que também tentam destruir os backups).',
      articuloReferencia: 'Art. 12, §2º a §7º; Anexo IV, Etapa 3, item 3.2',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { intervaloBackupCompletoHoras: 72, rpoMaximoHoras: 24 },
        CLASSE_2: { intervaloBackupCompletoHoras: 48, rpoMaximoHoras: 12 },
        CLASSE_3: { intervaloBackupCompletoHoras: 24, rpoMaximoHoras: 4 },
      },
      evidenciasExigidas: ['Política de backup documentada', 'Relatório de execução de backups (logs)', 'Comprovante dos dois ambientes de armazenamento independentes'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.3',
      titulo: 'Monitoramento de Backups com Alertas Automáticos',
      descricaoNorma: 'Monitorar continuamente as rotinas de backup quanto à execução bem-sucedida e à integridade dos dados restauráveis. Qualquer falha detectada deve gerar, de forma imediata, alerta técnico automático ao responsável e registro formal do incidente, com abertura de chamado para análise e correção.',
      explicacaoLeigo: 'Não basta programar o backup e esquecer — o sistema precisa avisar automaticamente se um backup falhar, e essa falha precisa virar um "chamado" formal para ser investigada e corrigida. Descobrir que os backups estavam falhando só na hora de uma emergência é o pior cenário possível.',
      articuloReferencia: 'Art. 12, §10; Anexo IV, Etapa 3, item 3.3',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Configuração de alertas automáticos de falha de backup', 'Registro de incidentes de falha de backup (se houver)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.4',
      titulo: 'Firewall com IPS/IDS e Segmentação Lógica de Rede',
      descricaoNorma: 'Implantar firewall stateful com IPS/IDS e segmentação lógica de rede. Para as Classes 2 e 3, mecanismos formais de segmentação (VLANs ou equivalente) são obrigatórios; para a Classe 1, admite-se medida técnica simplificada que impeça a comunicação irrestrita entre dispositivos administrativos e de uso público.',
      explicacaoLeigo: 'O firewall é a "portaria eletrônica" da rede, e o IPS/IDS detecta e bloqueia tentativas de invasão. Além disso, a rede interna precisa ser dividida em partes separadas (segmentação): os computadores administrativos não podem estar na mesma "rua" dos dispositivos de atendimento ao público. Cartórios maiores (Classes 2 e 3) precisam de VLANs formais; os menores podem usar uma solução mais simples, desde que funcione.',
      articuloReferencia: 'Art. 8º, §3º a §5º e VII; Anexo I, item 4; Anexo IV, Etapa 3, item 3.4',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Configuração do firewall e regras ativas', 'Documentação da segmentação de rede (VLANs ou equivalente)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.5',
      titulo: 'Proteção Avançada de Endpoint (Monitoramento Ativo)',
      descricaoNorma: 'Implementar solução avançada de proteção de endpoint, quando compatível com a classe da serventia, incluindo monitoramento ativo, detecção de comportamento anômalo ou recursos equivalentes de resposta a incidentes.',
      explicacaoLeigo: 'Além do antivírus básico da Etapa 2, cartórios de maior porte devem evoluir para uma proteção mais inteligente, que observa o comportamento dos computadores em tempo real e reage a ameaças novas (não apenas vírus já conhecidos). É proporcional à classe: quanto maior o cartório, mais sofisticada a proteção esperada.',
      articuloReferencia: 'Anexo II, item 3.1; Anexo IV, Etapa 3, item 3.5',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Relatório da solução de proteção avançada de endpoint (EDR ou equivalente)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.6',
      titulo: 'SGBD com Integridade Transacional e Logs Ativos',
      descricaoNorma: 'Utilizar Sistema Gerenciador de Banco de Dados (SGBD) com integridade transacional e rastreabilidade (logs), vedada a utilização de SGBDs cujo ciclo de suporte oficial do fabricante tenha sido encerrado (End of Life).',
      explicacaoLeigo: 'O banco de dados do cartório precisa garantir que uma operação ou é concluída por completo ou é totalmente desfeita (nunca "pela metade"), e precisa registrar logs de tudo que acontece. E não pode ser um banco de dados "aposentado" pelo fabricante, sem mais atualizações de segurança.',
      articuloReferencia: 'Art. 4º, §3º; Anexo I, item 5, I; Anexo IV, Etapa 3, item 3.6',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Identificação do SGBD utilizado e versão com suporte ativo', 'Comprovante de logs de integridade transacional habilitados'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.7',
      titulo: 'Tolerância a Falhas ou Alta Disponibilidade Compatível com a Classe',
      descricaoNorma: 'Implementar mecanismos de tolerância a falhas ou alta disponibilidade compatíveis com a classe. Para as Classes 1 e 2, admite-se arquitetura simplificada (virtualização com restauração automatizada, warm standby, nuvem com redundância regional ou redundância local com reposição rápida) desde que o RTO/RPO do PCN/PRD seja comprovadamente atendido; a Classe 3 deve dispor de mecanismos efetivos de Fault Tolerance ou HA.',
      explicacaoLeigo: 'O sistema precisa continuar funcionando (ou voltar a funcionar rapidamente) mesmo se um componente falhar. Cartórios pequenos podem usar soluções mais simples (como uma cópia "pronta para ligar" ou nuvem redundante), desde que cumpram o RTO/RPO definidos no PCN/PRD; cartórios grandes (Classe 3) precisam de mecanismos robustos de tolerância a falhas ou alta disponibilidade.',
      articuloReferencia: 'Art. 12, §7º; Anexo I, item 5, II e III; Anexo IV, Etapa 3, item 3.7',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Documentação da arquitetura de tolerância a falhas/alta disponibilidade adotada', 'Evidência de teste comprovando o RTO/RPO definidos'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa3.id,
      codigo: '3.8',
      titulo: 'Trilhas de Auditoria Técnicas Imutáveis',
      descricaoNorma: 'Implementar trilhas de auditoria técnicas imutáveis, com sincronização de tempo por fonte confiável, identificação inequívoca do usuário, registro de data e hora e mecanismo de verificação de integridade, assegurando sua integração obrigatória às rotinas de backup e recuperação, com preservação íntegra e rastreável, observados os prazos mínimos de retenção previstos no Provimento (5 anos).',
      explicacaoLeigo: 'Os logs de auditoria do cartório precisam ser à prova de adulteração: identificar claramente quem fez o quê, exatamente quando (com o relógio sincronizado por uma fonte confiável) e não poderem ser editados ou apagados por ninguém. Esses registros também precisam ser incluídos nas rotinas de backup, e guardados por, no mínimo, 5 anos.',
      articuloReferencia: 'Art. 10; Anexo II, item 3; Anexo IV, Etapa 3, item 3.8',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { nivelMinimo: 'Essencial', retencaoAnos: 5 },
        CLASSE_2: { nivelMinimo: 'Essencial', retencaoAnos: 5 },
        CLASSE_3: { nivelMinimo: 'Intermediário', retencaoAnos: 5 },
      },
      evidenciasExigidas: ['Configuração de trilhas de auditoria com sincronização de tempo', 'Comprovante de mecanismo de imutabilidade dos logs', 'Amostra de log de auditoria'],
      obrigatorio: true,
      metaExcelencia: false,
    },

    // ══════════════════ ETAPA 4 — Monitoramento, Auditoria e Validação de Controles ══════════════════
    {
      etapaId: etapa4.id,
      codigo: '4.1',
      titulo: 'Relatório de Conformidade de Auditoria das Trilhas',
      descricaoNorma: 'Emitir relatório de conformidade de auditoria, atestando a aderência integral das trilhas de auditoria aos requisitos técnicos do Anexo II, mediante procedimento documentado que comprove, cumulativamente, imutabilidade, identificação inequívoca do usuário, sincronização temporal por fonte confiável, retenção mínima e efetiva integração às rotinas de backup e recuperação.',
      explicacaoLeigo: 'Depois de implementar os logs na Etapa 3, agora é preciso comprovar formalmente que eles realmente funcionam como deveriam: o sistema registra quem fez o quê e quando, o relógio está sincronizado e os registros não podem ser alterados. Este relatório é a "prova" de que a trilha de auditoria é confiável, não apenas que ela existe.',
      articuloReferencia: 'Anexo IV, Etapa 4, item 4.1',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Relatório de conformidade de auditoria das trilhas'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.2',
      titulo: 'Rotina de Atualização Periódica de Sistemas e Aplicações',
      descricaoNorma: 'Instituir rotina documentada de atualização periódica de sistemas e aplicações, vedada a utilização de sistemas operacionais, SGBDs, aplicações críticas ou componentes com ciclo de suporte oficial encerrado (End of Life), mantendo evidência documental atualizada da vigência do suporte técnico.',
      explicacaoLeigo: 'Sistemas desatualizados são a porta de entrada mais comum para ataques. O cartório precisa ter um processo definido para manter tudo atualizado — sistema operacional, banco de dados, aplicações — e nunca usar software que o fabricante já parou de dar suporte (como um Windows antigo sem mais atualizações de segurança).',
      articuloReferencia: 'Art. 4º, §3º; Anexo II, item 5, I; Anexo IV, Etapa 4, item 4.2',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Rotina de atualização documentada', 'Relatório de inventário de software com versões e vigência de suporte'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.3',
      titulo: 'Gestão Formal de Vulnerabilidades (30 dias / 72h)',
      descricaoNorma: 'Implementar gestão formal de vulnerabilidades: tratamento de vulnerabilidades críticas em até 30 dias quando não houver exploração ativa; medidas imediatas de contenção e correção emergencial, preferencialmente em até 72 horas, quando houver exploração ativa, risco iminente ou comprometimento relevante; e registro formal, auditável e cronologicamente organizado das providências, com responsável e data de conclusão.',
      explicacaoLeigo: 'Vulnerabilidades são "buracos" de segurança nos sistemas. O cartório precisa de um processo para encontrá-las, classificá-las e corrigi-las: em até 30 dias se forem críticas mas não estiverem sendo exploradas, ou em até 72 horas se hackers já estiverem ativamente explorando a falha. Cada providência tomada precisa ficar registrada, com responsável e data.',
      articuloReferencia: 'Art. 11, §3º; Anexo II, item 5; Anexo IV, Etapa 4, item 4.3',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { prazoCriticaSemExploracaoDias: 30, prazoExploracaoAtivaHoras: 72 },
        CLASSE_2: { prazoCriticaSemExploracaoDias: 30, prazoExploracaoAtivaHoras: 72 },
        CLASSE_3: { prazoCriticaSemExploracaoDias: 30, prazoExploracaoAtivaHoras: 72 },
      },
      evidenciasExigidas: ['Política de gestão de vulnerabilidades', 'Registro formal das providências adotadas (data de identificação, classificação de risco, providências, encerramento)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.4',
      titulo: 'Simulação Anual de Desastre para Validação do PCN e PRD',
      descricaoNorma: 'Realizar simulação anual de cenário de desastre para validação prática do Plano de Continuidade de Negócios (PCN) e do Plano de Recuperação de Desastres (PRD).',
      explicacaoLeigo: 'Uma vez por ano, o cartório precisa simular uma situação de desastre (ex.: perda total do sistema principal) para testar, na prática, se o plano de continuidade realmente funciona — não basta ele existir no papel.',
      articuloReferencia: 'Anexo II, item 6, II; Anexo IV, Etapa 4, item 4.4',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Relatório/ata da simulação anual de desastre', 'Registro de ajustes feitos no PCN/PRD após a simulação'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.5',
      titulo: 'Testes Documentados de Restauração de Backup (Ata Anexo V)',
      descricaoNorma: 'Realizar e documentar testes de restauração de backup, com periodicidade compatível com a classe (Classe 3: semestral; Classes 1 e 2: anual), verificando a aderência aos parâmetros de RTO e RPO. O resultado deve ser registrado em ata no formato do Anexo V (ou formato equivalente que contenha os elementos essenciais).',
      explicacaoLeigo: 'Fazer backup não basta — é preciso testar de verdade se ele restaura os dados corretamente, dentro do tempo esperado (RTO) e sem perder mais dados do que o tolerável (RPO). Cartórios grandes (Classe 3) testam a cada 6 meses; os demais, uma vez por ano. O resultado do teste vira uma "ata" formal, no modelo do Anexo V da norma.',
      articuloReferencia: 'Art. 12, §9º; Anexo I, item 5, V; Anexo V; Anexo IV, Etapa 4, item 4.5',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { periodicidadeMeses: 12, rtoMaximoHoras: 24 },
        CLASSE_2: { periodicidadeMeses: 12, rtoMaximoHoras: 24 },
        CLASSE_3: { periodicidadeMeses: 6, rtoMaximoHoras: 8 },
      },
      evidenciasExigidas: ['Ata de teste de restauração no formato do Anexo V'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.6',
      titulo: 'Avaliações Técnicas Periódicas de Segurança',
      descricaoNorma: 'Realizar avaliações técnicas periódicas de segurança, com metodologias compatíveis com boas práticas reconhecidas.',
      explicacaoLeigo: 'Além dos testes de backup e do pentest (para quem se aplica), o cartório deve fazer revisões técnicas periódicas gerais de segurança — uma espécie de "checkup" recorrente dos controles implementados.',
      articuloReferencia: 'Anexo II, item 6, III e V; Anexo IV, Etapa 4, item 4.6',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Relatório de avaliação técnica periódica de segurança'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.7',
      titulo: 'Teste de Intrusão (Pentest) — Classe 3, a cada 2 anos',
      descricaoNorma: 'Para as serventias da Classe 3, realizar teste de intrusão (pentest) ou metodologia técnica equivalente, no mínimo a cada 2 anos, e adicionalmente sempre que houver alteração relevante de infraestrutura, arquitetura, exposição de serviços à internet ou troca de fornecedor crítico. Admite-se comprovação por relatório técnico coletivo quando a solução for centralizada/compartilhada, e dispensa da contratação individual quando a serventia operar 100% em SaaS sem infraestrutura própria exposta, mediante relatório do fornecedor e declaração do titular sobre a segurança das estações locais.',
      explicacaoLeigo: 'O pentest é um "teste de arrombamento autorizado": especialistas tentam invadir os sistemas do cartório para achar falhas antes que hackers reais o façam. Só é obrigatório para cartórios grandes (Classe 3), a cada 2 anos. Se o cartório usa apenas sistemas 100% em nuvem (SaaS) sem servidores próprios, pode ser dispensado, desde que apresente o relatório de segurança do fornecedor e uma declaração sobre a segurança das estações de trabalho locais.',
      articuloReferencia: 'Anexo II, item 6, IV e itens 6.1 a 6.3; Anexo IV, Etapa 4, item 4.7',
      classesAplicaveis: ['CLASSE_3'],
      parametrosPorClasse: {
        CLASSE_3: { periodicidadeMeses: 24, dispensaSaaSPuro: true },
      },
      evidenciasExigidas: ['Relatório de pentest (individual ou coletivo) com escopo, metodologia, data e plano de correção', 'Ou: relatório do fornecedor SaaS + declaração do titular (hipótese de dispensa)'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa4.id,
      codigo: '4.8',
      titulo: 'Análise de Causa Raiz e Lições Aprendidas dos Incidentes',
      descricaoNorma: 'Documentar análise de causa raiz e lições aprendidas para todos os incidentes de segurança da informação registrados pela serventia.',
      explicacaoLeigo: 'Para cada incidente de segurança que acontecer, não basta resolver o problema — é preciso investigar por que ele aconteceu (causa raiz) e documentar o que foi aprendido, para evitar que se repita.',
      articuloReferencia: 'Art. 11, §2º; Anexo II, item 4, IV; Anexo IV, Etapa 4, item 4.8',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Registros de análise de causa raiz e lições aprendidas dos incidentes (quando houver incidentes)'],
      obrigatorio: true,
      metaExcelencia: false,
    },

    // ══════════════════ ETAPA 5 — Interoperabilidade, Consolidação e Governança Evolutiva ══════════════════
    {
      etapaId: etapa5.id,
      codigo: '5.1',
      titulo: 'Interoperabilidade com Plataformas Eletrônicas de Fiscalização',
      descricaoNorma: 'Adequar os sistemas para interoperabilidade com plataformas eletrônicas de fiscalização e controle, assegurando intercâmbio estruturado de dados em formato aberto, identificação inequívoca da serventia, canal seguro de comunicação e manutenção de registros auditáveis das integrações.',
      explicacaoLeigo: 'Os sistemas do cartório precisam conseguir "conversar" tecnicamente com as plataformas de fiscalização da Corregedoria e do CNJ: enviar dados em formato aberto e legível por máquina, se identificar de forma inequívoca, usar um canal seguro de comunicação e manter registro de cada integração realizada.',
      articuloReferencia: 'Art. 19; Anexo IV, Etapa 5, item 5.1',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Documentação técnica da integração com plataformas de fiscalização', 'Registro auditável das integrações realizadas'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa5.id,
      codigo: '5.2',
      titulo: 'Padrões Abertos e Neutralidade Tecnológica',
      descricaoNorma: 'Adotar preferencialmente padrões abertos e formatos não proprietários (ex.: PDF/A, XML), prevenindo dependência exclusiva de fornecedor.',
      explicacaoLeigo: 'Sempre que possível, o cartório deve preferir formatos de arquivo abertos (como PDF/A e XML) em vez de formatos proprietários fechados. Isso evita ficar "preso" a um único fornecedor de tecnologia, facilitando trocas futuras.',
      articuloReferencia: 'Art. 8º, III; Anexo II, item 7; Anexo IV, Etapa 5, item 5.2',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Relação de formatos utilizados para documentos e dados críticos, com justificativa de adoção de padrões abertos'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa5.id,
      codigo: '5.3',
      titulo: 'Capacitação Periódica com Registro Formal',
      descricaoNorma: 'Instituir capacitação periódica dos responsáveis e colaboradores quanto à operação segura dos sistemas e rotinas de backup, com registro formal das capacitações realizadas.',
      explicacaoLeigo: 'A equipe do cartório precisa ser treinada periodicamente sobre como operar os sistemas com segurança e como funcionam as rotinas de backup — e cada treinamento precisa ficar registrado (ata, lista de presença, material usado).',
      articuloReferencia: 'Anexo I, item 7; Anexo IV, Etapa 5, item 5.3',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Ata de capacitação com lista de presença', 'Material do treinamento'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa5.id,
      codigo: '5.4',
      titulo: 'Revisão Periódica da Política de Segurança e Padrões Criptográficos',
      descricaoNorma: 'Revisar formalmente a Política de Segurança da Informação e os padrões criptográficos adotados sempre que houver alteração normativa relevante ou evolução tecnológica, com substituição tempestiva de algoritmos ou protocolos que se tornem vulneráveis.',
      explicacaoLeigo: 'A Política de Segurança não é um documento "engavetado": precisa ser revisada sempre que a lei mudar ou a tecnologia evoluir — por exemplo, se um algoritmo de criptografia usado hoje for considerado inseguro no futuro, ele precisa ser trocado rapidamente.',
      articuloReferencia: 'Anexo II, item 2, V; Anexo III, item 4.9, IV e item 5, IV; Anexo IV, Etapa 5, item 5.4',
      classesAplicaveis: TODAS,
      evidenciasExigidas: ['Histórico de revisões da Política de Segurança', 'Registro de atualização dos padrões criptográficos, quando aplicável'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa5.id,
      codigo: '5.5',
      titulo: 'Manutenção de Registros Auditáveis por 5 Anos',
      descricaoNorma: 'Manter registros auditáveis (logs, evidências do dossiê técnico, atas e demais documentos de conformidade) por, no mínimo, 5 anos, vedada a exclusão física dentro desse prazo.',
      explicacaoLeigo: 'Todos os registros de conformidade — logs, evidências, atas de teste, relatórios — precisam ficar guardados por pelo menos 5 anos, e não podem ser apagados antes disso, mesmo por engano. É a "memória" que comprova a conformidade do cartório ao longo do tempo.',
      articuloReferencia: 'Art. 10, §6º; Anexo II, item 3, IV; Anexo III, item 5, II; Anexo IV, Disposições Gerais, V e VIII; Anexo IV, Etapa 5, item 5.5',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { retencaoAnos: 5 },
        CLASSE_2: { retencaoAnos: 5 },
        CLASSE_3: { retencaoAnos: 5 },
      },
      evidenciasExigidas: ['Política de retenção documental com prazo mínimo de 5 anos'],
      obrigatorio: true,
      metaExcelencia: false,
    },
    {
      etapaId: etapa5.id,
      codigo: '5.6',
      titulo: 'Plano de Reversibilidade/Portabilidade e Simulação de Extração Integral do Acervo',
      descricaoNorma: 'Manter plano formal de reversibilidade e portabilidade de dados, acompanhado de simulação documentada de extração integral do acervo digital em formato interoperável e não proprietário — a realização da simulação deve preceder a declaração de conclusão desta etapa. Periodicidade mínima: Classe 3 a cada 24 meses; Classe 2 a cada 30 meses; Classe 1 a cada 36 meses; e imediatamente após alteração relevante de fornecedor, arquitetura ou governança.',
      explicacaoLeigo: 'O cartório precisa comprovar, na prática (não só no papel), que consegue extrair todo o seu acervo digital de forma completa e utilizável, caso precise trocar de fornecedor ou de sistema. Essa simulação de extração deve ser repetida periodicamente — a cada 2, 2,5 ou 3 anos, dependendo da classe — e também sempre que houver uma mudança relevante de fornecedor ou arquitetura.',
      articuloReferencia: 'Art. 6º, III; Art. 15; Anexo IV, Etapa 5, item 5.6',
      classesAplicaveis: TODAS,
      parametrosPorClasse: {
        CLASSE_1: { periodicidadeSimulacaoMeses: 36 },
        CLASSE_2: { periodicidadeSimulacaoMeses: 30 },
        CLASSE_3: { periodicidadeSimulacaoMeses: 24 },
      },
      evidenciasExigidas: ['Plano formal de reversibilidade e portabilidade de dados', 'Registro auditável da simulação de extração integral do acervo'],
      obrigatorio: true,
      metaExcelencia: false,
    },
  ]

  // ─── Limpeza de catálogo obsoleto ──────────────────────────────────────────
  // O catálogo de requisitos foi reescrito para refletir fielmente o Anexo IV
  // (a versão anterior tinha etapas e itens que não correspondiam ao texto da
  // norma). Códigos que não existem mais no catálogo atual são removidos,
  // desde que não haja evidências anexadas a eles — retenção legal de 5 anos
  // (Art. 10, §6º) impede exclusão física de evidências, então requisitos
  // obsoletos com evidências são preservados para migração manual.
  const codigosValidos = requisitos.map((r) => r.codigo)
  const obsoletos = await prisma.requisito.findMany({
    where: { codigo: { notIn: codigosValidos } },
  })
  if (obsoletos.length > 0) {
    const obsoletoIds = obsoletos.map((r) => r.id)
    const progressosObsoletos = await prisma.progressoRequisito.findMany({
      where: { requisitoId: { in: obsoletoIds } },
      select: { id: true },
    })
    const progressoIds = progressosObsoletos.map((p) => p.id)
    const evidenciasCount = progressoIds.length
      ? await prisma.evidencia.count({ where: { progressoRequisitoId: { in: progressoIds } } })
      : 0

    if (evidenciasCount > 0) {
      console.warn(
        `⚠ ${evidenciasCount} evidência(s) vinculada(s) a ${obsoletos.length} requisito(s) obsoleto(s) do catálogo anterior. ` +
        `Não foram excluídas automaticamente (retenção legal de 5 anos) — migração manual necessária.`,
      )
    } else {
      await prisma.progressoRequisito.deleteMany({ where: { requisitoId: { in: obsoletoIds } } })
      await prisma.requisito.deleteMany({ where: { id: { in: obsoletoIds } } })
      console.log(`✓ ${obsoletos.length} requisito(s) obsoleto(s) do catálogo anterior removido(s) (sem evidências anexadas).`)
    }
  }

  let count = 0
  for (const req of requisitos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonParams = req.parametrosPorClasse as any
    await prisma.requisito.upsert({
      where: { codigo: req.codigo },
      update: { ...req, parametrosPorClasse: jsonParams },
      create: { ...req, parametrosPorClasse: jsonParams },
    })
    count++
  }

  console.log(`✓ ${count} requisitos criados/atualizados`)
  console.log('Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
