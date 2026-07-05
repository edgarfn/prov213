# ─── Stage 1: dependências ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DATABASE_URL fictícia só para o prisma generate (não conecta ao banco)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia apenas o necessário para rodar
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/public ./public
# Cliente Prisma gerado em localização customizada (app/generated/prisma)
COPY --from=builder /app/app/generated ./app/generated

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Remove CRLF do Windows e torna executável
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Diretório de uploads persistido via volume
RUN mkdir -p /app/uploads

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
