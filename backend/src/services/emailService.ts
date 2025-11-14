import nodemailer from 'nodemailer';

// Configuração do email (usando variáveis de ambiente)
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '"7 SION" <noreply@7sion.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.7sion.com';

// Criar transportador de email
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT === 465, // true para 465, false para outras portas
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

// Verificar configuração do email
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ Email service configured correctly');
    return true;
  } catch (error) {
    console.warn('⚠️  Email service not configured:', error);
    return false;
  }
}

// Template de email para recuperação de senha
function getPasswordResetEmailTemplate(resetLink: string, userName: string = 'Usuário'): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - 7 SION</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">7 SION</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 14px;">Plataforma de Atendimento ao Cliente</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Recuperação de Senha</h2>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Olá <strong>${userName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta na plataforma 7 SION.
              </p>
              
              <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <!-- Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Ou copie e cole este link no seu navegador:
              </p>
              
              <p style="margin: 0 0 30px; padding: 12px; background-color: #f3f4f6; border-radius: 6px; word-break: break-all;">
                <a href="${resetLink}" style="color: #3b82f6; text-decoration: none; font-size: 14px;">${resetLink}</a>
              </p>
              
              <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
                <p style="margin: 0 0 10px; color: #ef4444; font-size: 14px; font-weight: 600;">
                  ⚠️ Importante:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
                  <li>Este link expira em <strong>1 hora</strong></li>
                  <li>Se você não solicitou esta alteração, ignore este email</li>
                  <li>Sua senha atual permanecerá ativa até você criar uma nova</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 13px; text-align: center;">
                Este é um email automático, por favor não responda.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} 7 SION - Plataforma de Atendimento ao Cliente
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Enviar email de recuperação de senha
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Recuperação de Senha - 7 SION',
      html: getPasswordResetEmailTemplate(resetLink, userName),
      text: `Olá ${userName || 'Usuário'},\n\nRecebemos uma solicitação para redefinir sua senha.\n\nClique no link abaixo para criar uma nova senha:\n${resetLink}\n\nEste link expira em 1 hora.\n\nSe você não solicitou esta alteração, ignore este email.\n\n7 SION - Plataforma de Atendimento ao Cliente`,
    });

    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
}

// Enviar email de confirmação após redefinição de senha
export async function sendPasswordChangedEmail(
  email: string,
  userName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: 'Senha Alterada com Sucesso - 7 SION',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Senha Alterada - 7 SION</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 90%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; line-height: 80px; font-size: 40px; color: #ffffff; margin-bottom: 20px;">
                ✓
              </div>
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">Senha Alterada com Sucesso</h2>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Olá <strong>${userName || 'Usuário'}</strong>,
              </p>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Sua senha foi alterada com sucesso. Você já pode fazer login com sua nova senha.
              </p>
              <p style="margin: 20px 0 0; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 14px; text-align: left;">
                <strong>⚠️ Atenção:</strong> Se você não realizou esta alteração, entre em contato conosco imediatamente.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} 7 SION - Plataforma de Atendimento ao Cliente
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
      text: `Olá ${userName || 'Usuário'},\n\nSua senha foi alterada com sucesso. Você já pode fazer login com sua nova senha.\n\nSe você não realizou esta alteração, entre em contato conosco imediatamente.\n\n7 SION - Plataforma de Atendimento ao Cliente`,
    });

    console.log('✅ Password changed confirmation email sent:', info.messageId);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending password changed email:', error);
    return { success: false, error: error.message };
  }
}
