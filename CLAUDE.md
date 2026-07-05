# Prompt para Claude Code — Sistema de Gestão da Implantação do Provimento CNJ 213/2026

> **Como usar:** salve este arquivo na raiz do seu projeto (por exemplo, como `CLAUDE.md` ou `SPEC.md`) e abra o Claude Code nessa pasta. Em seguida, peça: *"Leia o SPEC.md e construa o sistema descrito, começando pelo MVP da Fase 1."* O Claude Code usará este documento como fonte da verdade.

---

## 1. Contexto e objetivo

Você (Claude Code) vai construir um **sistema web de gestão da conformidade** que ajuda uma serventia extrajudicial (cartório) a planejar, executar, comprovar e auditar a implantação do **Provimento CNJ nº 213/2026** (padrões mínimos de TIC, segurança da informação, continuidade e LGPD).

O sistema deve funcionar como um **"copiloto de conformidade"**: traduz a norma em checklists acionáveis, controla prazos por classe, organiza evidências (dossiê técnico) e mostra o progresso em um dashboard interativo. O público inclui pessoas **leigas em TI**, então a linguagem da interface deve ser clara, com explicações em "tooltip" para cada termo técnico.

**Não** se trata de um sistema registral/notarial. É um sistema de **governança e acompanhamento da adequação normativa**.

---

## 2. Stack técnica obrigatória

- **Frontend:** Next.js 14+ (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Gráficos:** Recharts.
- **Backend / dados:** Supabase (Postgres + Auth + Storage + Row Level Security).
- **ORM/queries:** Supabase JS client (`@supabase/supabase-js`) com `@supabase/ssr` para Next.js.
- **Autenticação:** Supabase Auth (e-mail/senha) com **MFA habilitado** (a própria norma exige MFA — o sistema deve dar o exemplo).
- **Upload de evidências:** Supabase Storage (bucket privado por serventia).
- **Validação de formulários:** Zod + React Hook Form.
- **Datas/prazos:** date-fns.
- **Testes:** Vitest (unitários) + Playwright (e2e dos fluxos críticos).

> Há skills disponíveis para Supabase e boas práticas de Postgres e de design de frontend. **Consulte-as antes de modelar o banco e construir a UI.**

---

## 3. Modelo de domínio (entidades principais)

Modele no Postgres/Supabase. Use UUIDs, `created_at`/`updated_at`, e **RLS** isolando tudo por `serventia_id`.

### 3.1. `serventias`
- `id`, `nome`, `cns` (Código Nacional de Serventia), `cnpj`, `municipio`, `uf`
- `classe` (enum: `CLASSE_1`, `CLASSE_2`, `CLASSE_3`)
- `subclasse` (enum: A..J)
- `arrecadacao_semestral` (numeric)
- `tipo_solucao` (enum: `PROPRIA`, `CONTRATADA`, `COMPARTILHADA`, `COLETIVA`)
- `infra` (enum: `LOCAL`, `NUVEM`, `HIBRIDA`)
- `data_vigencia_norma` (date) — usada para calcular todos os prazos
- `responsavel_tecnico`, `controlador_dados`, `dpo` (campos de designação)

### 3.2. `etapas` (catálogo fixo — seed)
As 5 etapas do Anexo IV: `id`, `numero` (1–5), `titulo`, `escopo`, `condicoes_objetivas`.

### 3.3. `requisitos` (catálogo fixo — seed; o coração do sistema)
Cada item acionável da norma vira um requisito.
- `id`, `etapa_id`, `codigo` (ex.: `1.3`, `3.2`), `titulo`
- `descricao_norma` (texto técnico-legal)
- `explicacao_leigo` (versão em linguagem simples — **obrigatório**)
- `artigo_referencia` (ex.: "Art. 5º, §2º; Anexo II, item 1")
- `classes_aplicaveis` (array: quais classes precisam cumprir)
- `parametros_por_classe` (JSONB: ex.: RPO/RTO/intervalo de backup por classe)
- `evidencias_exigidas` (array de strings: o que precisa anexar)
- `obrigatorio` (bool) / `meta_excelencia` (bool)

### 3.4. `progresso_requisitos`
Liga uma serventia a cada requisito.
- `serventia_id`, `requisito_id`
- `status` (enum: `NAO_INICIADO`, `EM_ANDAMENTO`, `CONCLUIDO`, `NAO_APLICAVEL`)
- `responsavel_id`, `data_conclusao`, `observacoes`
- `solucao_adotada` (texto: descrição da solução técnica adotada)

### 3.5. `evidencias` (dossiê técnico)
- `id`, `progresso_requisito_id`, `nome_arquivo`, `storage_path`
- `hash_sha256` (calculado no upload — a norma exige integridade verificável)
- `tipo` (enum: `DOCUMENTO`, `CONTRATO`, `PRINT`, `LOG`, `RELATORIO`, `ATA`)
- `uploaded_by`, `uploaded_at`

### 3.6. `incidentes`
Gestão de incidentes de segurança (Art. 11; comunicação à Corregedoria em até 72h, meta 24h).
- `id`, `serventia_id`, `titulo`, `descricao`, `data_ocorrencia`, `data_ciencia`
- `gravidade` (enum: `BAIXO`, `MEDIO`, `ALTO`, `CRITICO`)
- `comunicado_corregedoria` (bool), `data_comunicacao`
- `comunicado_anpd` (bool) — para incidentes com dados pessoais (LGPD)
- `causa_raiz`, `medidas_corretivas`, `status` (aberto/em tratamento/encerrado)
- **Regra:** se `gravidade = CRITICO`, o sistema calcula e exibe o **prazo-limite de 72h** a partir de `data_ciencia` e alerta visualmente.

### 3.7. `vulnerabilidades`
- `id`, `serventia_id`, `descricao`, `data_identificacao`, `classificacao_risco`
- `exploracao_ativa` (bool) — se true, prazo de correção = 72h; senão, críticas = 30 dias
- `prazo_limite` (calculado), `data_encerramento`, `providencias`

### 3.8. `testes_restauracao`
Modelo do Anexo V (ata de teste de backup).
- `id`, `serventia_id`, `data_teste`, `sistemas_restaurados`
- `rto_aferido`, `rto_definido`, `rpo_aferido`, `rpo_definido`
- `conformidade` (enum: `INTEGRAL`, `PARCIAL`, `NAO_CONFORME`)
- `participantes` (JSONB), `evidencias` (relação), `arquitetura_backup` (JSONB)
- Função para **gerar a ata em PDF** no formato do Anexo V.

### 3.9. `declaracoes`
Registro das declarações de conclusão de etapa (Justiça Aberta).
- `serventia_id`, `etapa_id`, `data_declaracao`, `declarante`, `arquivo_declaracao`
- **Regra de bloqueio:** só permite declarar a etapa N se a etapa N-1 estiver 100% concluída (sequencialidade do Anexo IV).

### 3.10. `usuarios` / papéis
Papéis: `TITULAR`, `RESPONSAVEL_TECNICO`, `DPO`, `COLABORADOR`, `AUDITOR_LEITURA`. Toda ação relevante gera **log de auditoria** (ver seção 6).

---

## 4. Regras de negócio críticas (implemente como funções testáveis)

1. **Cálculo de prazos por classe** (a partir de `data_vigencia_norma`):
   - Etapas 1 e 2 (art. 20): Classe 3 = 90 dias, Classe 2 = 150 dias, Classe 1 = 210 dias.
   - Conclusão total (art. 23): Classe 3 = 24 meses, Classe 2 = 30 meses, Classe 1 = 36 meses.
   - Suporte a **prorrogação única de até 90 dias** (flag + nova data + justificativa).
2. **Parâmetros técnicos por classe** (exibir e validar):
   - RPO: C1=24h, C2=12h, C3=4h. RTO: C1=24h, C2=24h, C3=8h.
   - Backup completo: C1 ≤72h, C2 ≤48h, C3 ≤24h.
   - Internet de referência: C1=2, C2=10, C3=50 Mbps.
   - Teste de restauração: C3 semestral; C1/C2 anual.
   - Pentest: só C3, a cada 2 anos (com dispensa para SaaS puro).
   - Retenção de logs/evidências: **5 anos** (todas as classes).
3. **Sequencialidade das etapas:** bloquear avanço/declaração fora de ordem.
4. **Aplicabilidade por classe:** ocultar/marcar como "não aplicável" requisitos que não incidem sobre a classe da serventia (ex.: pentest para C1).
5. **Hash de integridade:** todo upload de evidência calcula SHA-256 e o sistema permite **exportar a "lista de hashes assinável"** do dossiê (exigência das Classes 2 e 3).
6. **Alertas de prazo:** semáforo (verde > 30 dias; amarelo ≤ 30 dias; vermelho vencido) para etapas, incidentes críticos (72h) e vulnerabilidades.
7. **Relatório simplificado x dossiê técnico:** Classe 1 usa fluxo de comprovação simplificado; Classes 2 e 3 exigem dossiê com hash + repositório auditável.

---

## 5. Telas / funcionalidades (escopo de UI)

### 5.1. Dashboard principal (página inicial)
- **Cartões de KPI:** % de conclusão geral, % por etapa, requisitos concluídos/total, dias restantes para o próximo prazo legal.
- **Gráfico de rosca (Recharts):** progresso por etapa.
- **Gráfico de barras:** requisitos por status.
- **Linha do tempo / Gantt simplificado:** etapas com prazos legais e datas previstas/reais.
- **Painel de alertas:** prazos vencendo, incidentes críticos abertos, vulnerabilidades em aberto, backups sem teste recente.
- **Semáforo de conformidade** por etapa.

### 5.2. Onboarding / Configuração da serventia
- Wizard que pergunta classe, infra, tipo de solução e data de vigência → o sistema **personaliza automaticamente** os checklists e prazos. Se o usuário não souber a classe, oferecer uma calculadora a partir da arrecadação semestral.

### 5.3. Checklists por etapa (tela central de trabalho)
- Lista de requisitos da etapa, agrupados, com: status editável, responsável, campo "solução adotada", botão de anexar evidência, e um **ícone "?" que abre a `explicacao_leigo` + `artigo_referencia`**.
- Barra de progresso da etapa e botão "Declarar conclusão da etapa" (só habilita a 100%).

### 5.4. Dossiê técnico / Evidências
- Repositório de arquivos por requisito, com hash visível, filtros e **exportação do pacote probatório** (ZIP com índice + lista de hashes).

### 5.5. Módulo de Incidentes
- CRUD + cronômetro de 72h para críticos + geração de comunicado padrão à Corregedoria/ANPD.

### 5.6. Módulo de Vulnerabilidades
- CRUD + cálculo de prazo (30 dias / 72h) + registro de providências.

### 5.7. Módulo de Testes de Restauração
- Formulário no formato do **Anexo V** + **geração de PDF da ata** + histórico + verificação de aderência a RTO/RPO.

### 5.8. Relatórios
- "Relatório de status de conformidade" (PDF) para a Corregedoria.
- "Relatório simplificado" (Classe 1) no formato do Anexo IV, item VII.

### 5.9. Administração
- Gestão de usuários e papéis; configurações da serventia; **log de auditoria** consultável.

---

## 6. Segurança e LGPD (o sistema deve praticar o que prega)

- **RLS no Supabase** isolando dados por `serventia_id`; nenhum usuário enxerga outra serventia.
- **MFA obrigatório** para papéis administrativos.
- **Trilha de auditoria imutável:** tabela `audit_log` (append-only) registrando usuário, ação, entidade, timestamp (UTC sincronizado), valor antigo/novo. Bloquear update/delete via policy.
- **Criptografia:** HTTPS/TLS em trânsito; buckets privados; dados em repouso criptografados (recurso nativo do Supabase). Nunca expor service-role key no client.
- **Princípio do menor privilégio** nos papéis.
- **Retenção:** não permitir exclusão física de evidências/logs dentro do prazo de 5 anos (soft-delete + bloqueio).
- **Política de senhas forte** e sessão com expiração.

---

## 7. Seed de dados (entregável obrigatório)

Crie um seed que popule **as 5 etapas e todos os requisitos** mapeados do Provimento, cada um com `explicacao_leigo`, `artigo_referencia`, `classes_aplicaveis` e `parametros_por_classe`. Use como base, no mínimo, os itens do Anexo IV (Etapas 1–5), os controles do Anexo II (criptografia, MFA, logs, incidentes, vulnerabilidades, testes) e a infraestrutura do Anexo I. **Esse seed é o que dá valor ao sistema — capriche na completude e na clareza das explicações para leigos.**

---

## 8. Plano de construção (faseado — siga nesta ordem)

**MVP (Fase 1):** setup do projeto, Supabase, schema + RLS, auth com MFA, onboarding da serventia, seed das etapas/requisitos, checklists por etapa com anexo de evidências (hash), e dashboard com KPIs e progresso. Entregue isso funcionando ponta a ponta antes de prosseguir.

**Fase 2:** módulos de Incidentes, Vulnerabilidades e Testes de Restauração (com geração da ata Anexo V em PDF).

**Fase 3:** relatórios em PDF (status, relatório simplificado), exportação do dossiê com lista de hashes, log de auditoria consultável.

**Fase 4:** refinamentos de UX para leigos (tooltips, textos de ajuda), testes e2e dos fluxos críticos, modo "solução coletiva" (uma entidade gerenciando várias serventias).

---

## 9. Critérios de aceite

- Um titular leigo consegue, sem ajuda, configurar a serventia e entender o que precisa fazer.
- Os prazos e parâmetros exibidos correspondem exatamente à classe selecionada.
- Não é possível declarar uma etapa fora de ordem ou sem 100% dos requisitos.
- Toda evidência anexada tem hash SHA-256 e é isolada por serventia (RLS comprovada por teste).
- A ata de teste de restauração é gerada em PDF no formato do Anexo V.
- Incidentes críticos exibem corretamente o prazo-limite de 72h.
- Há testes automatizados cobrindo o cálculo de prazos, a sequencialidade de etapas e a aplicabilidade por classe.

---

## 10. Diretrizes de execução para o Claude Code

- Trabalhe em **commits pequenos e descritivos**; explique decisões de arquitetura no `README`.
- Antes de modelar banco e UI, **leia as skills de Supabase, Postgres e frontend-design** disponíveis no ambiente.
- Priorize **clareza para leigos** na interface: cada termo técnico tem ajuda contextual.
- Não invente exigências fora da norma; quando um requisito for de interpretação, marque-o e cite o artigo.
- Garanta que o próprio sistema seja **um exemplo de conformidade** (MFA, RLS, logs imutáveis, criptografia).
- Comece pelo **MVP da Fase 1** e só avance após validá-lo.
