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

# Variáveis NEXT_PUBLIC_* são inlined no bundle do cliente durante "next build"
# — diferente das demais, definir só em docker-compose.yml "environment:" (que
# só afeta o processo em RUNTIME) não tem efeito nenhum nelas. Precisam chegar
# aqui, em build-time, via --build-arg (ver docker-compose.yml "build.args").
# Sem isso, o bundle é compilado com a variável vazia/undefined e o widget do
# Turnstile não é renderizado (ou passa a usar um valor desatualizado se a
# imagem não for reconstruída após trocar o valor no .env).
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

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
