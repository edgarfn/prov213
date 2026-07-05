// Carrega o `.env` do servidor (nunca commitado) para dentro do processo do PM2
// ANTES de montar env_production abaixo. Sem isso, o PM2 só define NODE_ENV/PORT
// e o Next.js cai no próprio carregamento automático de .env* — se o arquivo
// presente no servidor tiver valores de dev (ex.: NEXTAUTH_URL=localhost:3000),
// a aplicação usa esse valor errado em produção sem avisar (foi exatamente a
// causa do bug de logout/redirects indo para localhost em produção).
require('dotenv').config()

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `PM2/ecosystem.config.js: variável de ambiente obrigatória "${name}" não definida. ` +
      `Configure-a no .env do servidor (ver .env.example) antes de rodar "pm2 start ecosystem.config.js --env production".`,
    )
  }
  return value
}

const nextAuthUrl = required('NEXTAUTH_URL')
if (nextAuthUrl.includes('localhost')) {
  // Não impede o start (pode ser um ambiente de staging de propósito), mas
  // avisa alto no log — foi exatamente um NEXTAUTH_URL apontando para
  // localhost em produção que causou o logout/redirects quebrados.
  console.warn(
    `\n⚠️  AVISO: NEXTAUTH_URL="${nextAuthUrl}" contém "localhost" — se este for o ` +
    'ambiente de produção, os links de logout, redirecionamento e recuperação de ' +
    'senha vão apontar para localhost e falhar para os usuários reais.\n',
  )
}

module.exports = {
  apps: [
    {
      name: 'prov213',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: required('DATABASE_URL'),
        NEXTAUTH_URL: required('NEXTAUTH_URL'),
        NEXTAUTH_SECRET: required('NEXTAUTH_SECRET'),
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: required('NEXT_PUBLIC_TURNSTILE_SITE_KEY'),
        TURNSTILE_SECRET_KEY: required('TURNSTILE_SECRET_KEY'),
        UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
        // SMTP e ADMIN_EMAIL são opcionais — repassados apenas se definidos no .env
        ...(process.env.SMTP_HOST && {
          SMTP_HOST: process.env.SMTP_HOST,
          SMTP_PORT: process.env.SMTP_PORT,
          SMTP_SECURE: process.env.SMTP_SECURE,
          SMTP_USER: process.env.SMTP_USER,
          SMTP_PASS: process.env.SMTP_PASS,
          SMTP_FROM: process.env.SMTP_FROM,
        }),
        ...(process.env.ADMIN_EMAIL && { ADMIN_EMAIL: process.env.ADMIN_EMAIL }),
      },
    },
  ],
}
