import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { getConfig } from './config.js';
import { logger } from './logger.js';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  channel: 'postbox' | 'smtp' | 'console';
  error?: string;
  simulated?: boolean;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Cached nodemailer transporter singleton
let cachedTransporter: any = null;

function getTransporter(): any {
  const cfg = getConfig();
  if (cachedTransporter) return cachedTransporter;

  if (cfg.POSTBOX_SMTP_USER && cfg.POSTBOX_SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: cfg.POSTBOX_SMTP_HOST || 'postbox.cloud.yandex.net',
      port: cfg.POSTBOX_SMTP_PORT || 465,
      secure: (cfg.POSTBOX_SMTP_PORT || 465) === 465,
      auth: {
        user: cfg.POSTBOX_SMTP_USER,
        pass: cfg.POSTBOX_SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    return cachedTransporter;
  }

  return null;
}

/**
 * Universal Email Delivery Service
 *
 * Supports Yandex Cloud Postbox / SMTP with zero-crash fallback to safe console mode
 * for Dev / Staging before custom domain DNS delegation is complete.
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  const cfg = getConfig();
  const { to, subject, html, text } = options;
  const from = cfg.EMAIL_FROM || 'DomExit <no-reply@domexit.ru>';

  const provider = cfg.EMAIL_PROVIDER || 'console';
  const transporter = (provider === 'postbox' || provider === 'smtp') ? getTransporter() : null;

  if (transporter && provider !== 'console') {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });

      logger.info('Email sent successfully via Postbox/SMTP', {
        meta: { to: maskEmail(to), messageId: info.messageId },
      });

      return {
        success: true,
        messageId: info.messageId,
        channel: provider as 'postbox' | 'smtp',
        simulated: false,
      };
    } catch (err: any) {
      logger.error('Failed to send email via Postbox/SMTP, falling back to simulated log', {
        meta: { to: maskEmail(to), error: err.message },
      });

      // Non-fatal fallback: do not crash client request
      return {
        success: false,
        channel: provider as 'postbox' | 'smtp',
        error: err.message,
        simulated: false,
      };
    }
  }

  // Safe Console / Staging Simulation Mode
  const simulatedId = `sim-${crypto.randomUUID().substring(0, 12)}`;
  logger.info('[EmailService:Simulated] Email dispatched in dev/staging mode', {
    meta: {
      to: maskEmail(to),
      subject,
      simulatedId,
      channel: 'console',
    },
  });

  return {
    success: true,
    messageId: simulatedId,
    channel: 'console',
    simulated: true,
  };
}

/**
 * Helper to mask emails according to 152-FZ privacy
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// =============================================================================
// DOMEXIT LIGHT EMERALD RESPONSIVE EMAIL TEMPLATES
// =============================================================================

const EMAIL_STYLE_HEADER = `
  <div style="background-color: #f8fafc; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px 32px; text-align: left;">
        <div style="display: inline-block; vertical-align: middle;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">
            DomExit<span style="color: #6ee7b7;">.ru</span>
          </h1>
          <p style="margin: 2px 0 0; color: #d1fae5; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
            Цифровой сервис срочного выкупа недвижимости
          </p>
        </div>
      </div>
      <div style="padding: 32px;">
`;

const EMAIL_STYLE_FOOTER = `
      </div>
      <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
        <p style="margin: 0 0 6px;">
          Вы получили это письмо, так как зарегистрированы на платформе <strong>DomExit.ru</strong>.
        </p>
        <p style="margin: 0;">
          Российская Федерация, Санкт-Петербург • Защита персональных данных в соответствии со 152-ФЗ • 63-ФЗ «Об электронной подписи»
        </p>
      </div>
    </div>
  </div>
`;

/**
 * 1. Template: Password Recovery Email
 */
export function renderPasswordResetEmail(params: {
  code: string;
  expiresInMinutes?: number;
}): { subject: string; html: string; text: string } {
  const { code, expiresInMinutes = 15 } = params;
  const subject = `Код восстановления пароля: ${code} — DomExit.ru`;

  const html = `
    ${EMAIL_STYLE_HEADER}
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 800; color: #0f172a;">
        Восстановление доступа к аккаунту
      </h2>
      <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
        Был получен запрос на сброс пароля для вашей учетной записи на платформе DomExit. Введите следующий одноразовый код для установки нового пароля:
      </p>

      <div style="background-color: #ecfdf5; border: 2px dashed #059669; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          Одноразовый код подтверждения
        </div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; color: #065f46; letter-spacing: 8px;">
          ${code}
        </div>
        <div style="font-size: 12px; color: #059669; margin-top: 6px; font-weight: 600;">
          Действителен в течение ${expiresInMinutes} минут
        </div>
      </div>

      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
          <strong>Безопасность:</strong> Никому не сообщайте этот код, включая сотрудников DomExit. Если вы не отправляли запрос, просто проигнорируйте это письмо — ваш пароль останется без изменений.
        </p>
      </div>
    ${EMAIL_STYLE_FOOTER}
  `;

  const text = `
DomExit.ru — Восстановление доступа к аккаунту

Ваш одноразовый код для сброса пароля: ${code}
Срок действия: ${expiresInMinutes} минут.

Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.
  `.trim();

  return { subject, html, text };
}

/**
 * 2. Template: PEP 63-FZ Electronic Signature OTP Email
 */
export function renderPepOtpEmail(params: {
  code: string;
  documentTitle: string;
  lotCode: string;
  sha256Fingerprint: string;
  expiresInMinutes?: number;
}): { subject: string; html: string; text: string } {
  const { code, documentTitle, lotCode, sha256Fingerprint, expiresInMinutes = 5 } = params;
  const subject = `Код подписи ПЭП (63-ФЗ): ${code} — Лот #${lotCode} — DomExit.ru`;

  const html = `
    ${EMAIL_STYLE_HEADER}
      <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase; margin-bottom: 12px;">
        Простая электронная подпись (ПЭП • 63-ФЗ)
      </div>

      <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 800; color: #0f172a;">
        Подтверждение подписания документа
      </h2>
      <p style="margin: 0 0 16px; font-size: 13px; color: #475569; line-height: 1.5;">
        Вы инициировали подписание документа <strong>«${documentTitle}»</strong> в отношении объекта <strong>#${lotCode}</strong> на платформе DomExit.
      </p>

      <div style="background-color: #ecfdf5; border: 2px solid #059669; border-radius: 16px; padding: 20px; text-align: center; margin: 20px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
          Одноразовый код ПЭП
        </div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; color: #065f46; letter-spacing: 6px;">
          ${code}
        </div>
        <div style="font-size: 12px; color: #059669; margin-top: 6px; font-weight: 600;">
          Срок действия: ${expiresInMinutes} минут (макс. 3 попытки)
        </div>
      </div>

      <div style="background-color: #f1f5f9; border-radius: 12px; padding: 14px 16px; margin: 20px 0; font-size: 11px; color: #475569; line-height: 1.5;">
        <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">Криптографический хэш документа (SHA-256):</div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 10px; word-break: break-all; color: #334155;">
          ${sha256Fingerprint}
        </div>
      </div>

      <p style="margin: 16px 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">
        ⚠️ <strong>Юридическая сила:</strong> Вводя данный код в форме подписания DomExit, вы подписываете документ Простой Электронной Подписью в соответствии со статьями 5 и 9 Федерального закона № 63-ФЗ. Данная подпись признается равнозначной собственноручной подписи на бумажном носителе.
      </p>
    ${EMAIL_STYLE_FOOTER}
  `;

  const text = `
DomExit.ru — Простая электронная подпись (ПЭП • 63-ФЗ)

Документ: ${documentTitle}
Объект: #${lotCode}

Ваш код подтверждения ПЭП: ${code}
Срок действия: ${expiresInMinutes} минут.

Криптографический отпечаток документа (SHA-256):
${sha256Fingerprint}

Вводя код на платформе DomExit, вы подписываете документ простой электронной подписью согласно 63-ФЗ.
  `.trim();

  return { subject, html, text };
}

/**
 * 3. Template: Deals, Buy-Box, and Partner Notifications
 */
export function renderNotificationEmail(params: {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  highlightDetails?: Record<string, string>;
}): { subject: string; html: string; text: string } {
  const { title, message, actionUrl, actionLabel, highlightDetails } = params;
  const subject = `${title} — DomExit.ru`;

  let detailsHtml = '';
  if (highlightDetails && Object.keys(highlightDetails).length > 0) {
    detailsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 18px 0;">
        ${Object.entries(highlightDetails)
          .map(
            ([k, v]) => `
          <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
            <span style="color: #64748b;">${k}:</span>
            <span style="font-weight: 700; color: #0f172a;">${v}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  let buttonHtml = '';
  if (actionUrl && actionLabel) {
    buttonHtml = `
      <div style="text-align: center; margin: 26px 0 10px;">
        <a href="${actionUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.25);">
          ${actionLabel} →
        </a>
      </div>
    `;
  }

  const html = `
    ${EMAIL_STYLE_HEADER}
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 800; color: #0f172a;">
        ${title}
      </h2>
      <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
        ${message}
      </p>

      ${detailsHtml}
      ${buttonHtml}
    ${EMAIL_STYLE_FOOTER}
  `;

  const text = `
DomExit.ru — ${title}

${message}

${actionUrl ? `${actionLabel || 'Перейти'}: ${actionUrl}` : ''}
  `.trim();

  return { subject, html, text };
}
