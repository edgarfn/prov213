#!/bin/sh
set -e

# Aviso cedo se NEXTAUTH_URL parecer um endereço local — não bloqueia o boot
# (pode ser um ambiente de staging de propósito), mas evita repetir o bug de
# logout/redirects apontando para localhost em produção.
case "$NEXTAUTH_URL" in
  *localhost*)
    echo "⚠️  AVISO: NEXTAUTH_URL=\"$NEXTAUTH_URL\" contém 'localhost' — se este for produção, logout/redirects/e-mails de recuperação de senha vão quebrar para os usuários reais."
    ;;
esac

echo "⏳ Aguardando banco de dados..."
until npx prisma migrate deploy 2>&1; do
  echo "   Banco indisponível, tentando em 3s..."
  sleep 3
done

# O catálogo de Etapas/Requisitos do Provimento só existe depois do seed —
# migrate deploy cria as tabelas, mas não as popula. Rodar aqui, sempre, é o
# que garante que um banco novo (ou resetado) nunca fique com a tela de
# Checklists vazia em produção. Seguro repetir: prisma/seed.ts usa upsert por
# número de etapa/código de requisito, então não duplica nem sobrescreve
# progresso já lançado pelos usuários.
echo "🌱 Aplicando seed (catálogo de Etapas/Requisitos)..."
npm run db:seed

echo "✅ Migrações e seed aplicados. Iniciando servidor..."
exec node node_modules/next/dist/bin/next start
