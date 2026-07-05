# Prov213 — Copiloto de Conformidade CNJ

Sistema de gestão da implantação do **Provimento CNJ nº 213/2026** (padrões mínimos de TIC, segurança da informação, continuidade e LGPD para serventias extrajudiciais).

## Stack

- **Next.js 16** (App Router + Server Actions)
- **PostgreSQL** via Docker + **Prisma ORM v7** (`@prisma/adapter-pg`)
- **NextAuth.js v4** — JWT sessions + TOTP MFA via `otplib`
- **shadcn/ui** sobre **Base UI** (`@base-ui/react`)
- **Recharts** para gráficos | **date-fns** para prazos
- **Zod + React Hook Form** | **Vitest** (29 testes unitários)

## Setup rápido

### 1. Subir o banco de dados

```bash
docker-compose up -d
```

### 2. Instalar dependências e gerar o cliente Prisma

```bash
npm install
npm run db:generate
```

### 3. Criar as tabelas e popular dados

```bash
npm run db:migrate    # Cria as tabelas
npm run db:seed       # Popula as 5 etapas + 28 requisitos do Provimento 213
```

### 4. Iniciar o servidor

```bash
npm run dev           # http://localhost:3000
```

## Fluxo de uso

1. **Criar conta** → `/registro`
2. **Login** → `/login`
3. **Onboarding** → Configurar a serventia (nome, CNS, classe, infraestrutura, data de vigência)
4. **Dashboard** → Progresso geral, KPIs, gráficos, prazos com semáforo
5. **Checklists** → Por etapa: marcar status, solução adotada, anexar evidências com SHA-256
6. **Declarar etapa** → Só habilitado a 100% dos obrigatórios + sequencialidade respeitada
7. **Evidências** → Dossiê técnico com hashes SHA-256 para auditoria
8. **Configurações** → Ativar MFA (app autenticador) — exigência da própria norma

## Regras de negócio testadas

| Regra | Função | Testes |
|-------|--------|--------|
| Prazos por classe (Art. 20/23) | `calcularPrazos` | 6 casos |
| Semáforo de prazos | `calcularSemaforo` | 4 casos |
| Parâmetros técnicos RPO/RTO/backup | `parametrosPorClasse` | 4 casos |
| Prazo 72h incidentes críticos | `prazoIncidenteCritico` | 1 caso |
| Prazo vulnerabilidades (72h/30d) | `prazoVulnerabilidade` | 2 casos |
| Classificação por arrecadação | `calcularClassePorArrecadacao` | 3 casos |
| Sequencialidade das etapas | `podeDeclaraEtapa` | 5 casos |
| Aplicabilidade por classe | `requisitoAplicavel` | 4 casos |

## Segurança

- **Isolamento por serventia**: toda query filtra por `serventiaId` do usuário autenticado
- **RBAC**: TITULAR / RESPONSAVEL_TECNICO / DPO / COLABORADOR / AUDITOR_LEITURA
- **MFA**: TOTP (RFC 6238) via `otplib` — ativável nas configurações
- **Audit log**: toda ação relevante em `AuditLog` (append-only por convenção)
- **Soft-delete de evidências**: `deletedAt` — sem exclusão física (5 anos de retenção)
- **SHA-256**: calculado no servidor no upload; exibido no dossiê

## Comandos

```bash
npm run dev           # Desenvolvimento
npm run build         # Build de produção
npm run test          # 29 testes unitários
npm run db:studio     # Prisma Studio (explorador visual)
npm run db:reset      # Apaga e re-cria banco (cuidado!)
```

## Notas de arquitetura

- **Prisma v7**: URL de conexão no `prisma.config.ts` (não no schema); import de tipos de `app/generated/prisma/models/*Model`
- **Base UI**: substitui Radix UI no shadcn v4 — sem `asChild`, triggers estilizados diretamente
- **otplib v13**: API funcional pura (`verifySync`, `generateSecret`, `generateURI`)
- **Fases futuras**: Incidentes, Vulnerabilidades, Testes de Restauração (Fase 2), Relatórios PDF (Fase 3)
