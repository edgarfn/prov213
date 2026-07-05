import nodemailer from 'nodemailer'

function createTransport() {
  const host = process.env.SMTP_HOST
  if (!host) return null

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

const FROM = process.env.SMTP_FROM ?? 'noreply@prov213.local'
const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

export async function sendPasswordResetEmail(
  toEmail: string,
  token: string,
): Promise<void> {
  const link = `${APP_URL}/redefinir-senha?token=${token}`
  const subject = 'Prov213 — Redefinição de senha'
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e40af">Redefinição de senha</h2>
      <p>Você solicitou a redefinição da sua senha no sistema <strong>Prov213</strong>.</p>
      <p>Clique no botão abaixo. O link expira em <strong>1 hora</strong>.</p>
      <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;
         background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
        Redefinir senha
      </a>
      <p style="color:#64748b;font-size:13px">
        Se você não solicitou isso, ignore este e-mail.<br>
        Link direto: <a href="${link}">${link}</a>
      </p>
    </div>
  `

  const transport = createTransport()
  if (!transport) {
    // Sem SMTP configurado — exibe no console para dev/testes
    console.log('\n════════════════════════════════════════')
    console.log(' [EMAIL] Reset de senha (sem SMTP configurado)')
    console.log(` Para: ${toEmail}`)
    console.log(` Link: ${link}`)
    console.log('════════════════════════════════════════\n')
    return
  }

  await transport.sendMail({ from: FROM, to: toEmail, subject, html })
}

export async function sendWelcomeEmail(
  toEmail: string,
  tempPassword: string,
): Promise<void> {
  const subject = 'Prov213 — Bem-vindo(a)! Acesse com sua senha provisória'
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e40af">Bem-vindo(a) ao Prov213</h2>
      <p>Sua conta foi criada no sistema de conformidade do <strong>Provimento CNJ 213/2026</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 8px;color:#64748b">E-mail:</td>
            <td style="padding:4px 8px;font-weight:bold">${toEmail}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b">Senha provisória:</td>
            <td style="padding:4px 8px;font-weight:bold;font-family:monospace">${tempPassword}</td></tr>
      </table>
      <p style="color:#b45309;background:#fef3c7;padding:12px;border-radius:6px">
        ⚠️ Você será solicitado(a) a <strong>trocar a senha</strong> no primeiro acesso.
      </p>
      <a href="${APP_URL}/login" style="display:inline-block;margin:16px 0;padding:12px 24px;
         background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
        Acessar o sistema
      </a>
    </div>
  `

  const transport = createTransport()
  if (!transport) {
    console.log('\n════════════════════════════════════════')
    console.log(' [EMAIL] Boas-vindas (sem SMTP configurado)')
    console.log(` Para: ${toEmail} | Senha: ${tempPassword}`)
    console.log('════════════════════════════════════════\n')
    return
  }

  await transport.sendMail({ from: FROM, to: toEmail, subject, html })
}
