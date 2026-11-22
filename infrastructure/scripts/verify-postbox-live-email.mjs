#!/usr/bin/env node
/**
 * Verify Postbox Identity and Send Single Diagnostic Live Email to Owner
 * Zero DB writes!
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

if (!fs.existsSync(ENV_PATH)) {
  console.error('FATAL: .env.cloud.local not found');
  process.exit(1);
}

const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const smtpHost = envVars.POSTBOX_SMTP_HOST || 'postbox.cloud.yandex.net';
const smtpPort = Number(envVars.POSTBOX_SMTP_PORT || 465);
const smtpUser = envVars.POSTBOX_SMTP_USER;
const smtpPass = envVars.POSTBOX_SMTP_PASS;
const emailFrom = envVars.EMAIL_FROM || 'DomExit <no-reply@domexit.ru>';
const ownerEmail = 'amaas9499@gmail.com';

if (!smtpUser || !smtpPass) {
  console.error('FATAL: POSTBOX_SMTP_USER or POSTBOX_SMTP_PASS missing in .env.cloud.local');
  process.exit(1);
}

console.log('=== Yandex Cloud Postbox Live Email Verification ===');
console.log('SMTP Host:     ', smtpHost);
console.log('SMTP Port:     ', smtpPort);
console.log('SMTP User ID:  ', smtpUser);
console.log('Email From:    ', emailFrom);
console.log('Recipient:     ', ownerEmail);
console.log('Database Mode:  STRICT READ-ONLY (0 writes to YDB)\n');

const nodemailer = require(path.join(ROOT_DIR, 'backend/node_modules/nodemailer'));

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: { user: smtpUser, pass: smtpPass },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

async function main() {
  console.log('[1/2] Verifying SMTP Connection...');
  await new Promise((resolve, reject) => {
    transporter.verify((err, success) => {
      if (err) return reject(err);
      console.log('✓ SMTP Connection & Auth Verified successfully!');
      resolve(success);
    });
  });

  console.log('\n[2/2] Sending Diagnostic Email to Owner...');
  const subject = 'DomExit.ru запущен — проверка почты Postbox';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b1514; color: #e6f4f1; padding: 24px; }
          .card { background: #132422; border: 1px solid #1f3b37; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; }
          .badge { display: inline-block; background: #10b981; color: #042f2e; font-weight: bold; padding: 4px 10px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
          h2 { color: #34d399; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; }
          .details { background: #0b1514; border-radius: 8px; padding: 16px; margin: 20px 0; font-family: monospace; font-size: 13px; color: #a7f3d0; }
          .btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">PRODUCTION READY</div>
          <h2>Платформа DomExit.ru успешно запущена!</h2>
          <p>Это тестовое диагностическое сообщение подтверждает, что почтовая подсистема <strong>Yandex Cloud Postbox</strong> подключена, авторизована и функционирует в штатном режиме.</p>
          <div class="details">
            <strong>Домен:</strong> https://domexit.ru<br>
            <strong>Почтовый сервис:</strong> Yandex Cloud Postbox (SMTP SSL :465)<br>
            <strong>Отправитель:</strong> no-reply@domexit.ru<br>
            <strong>Статус сертификата SSL:</strong> ISSUED (Let's Encrypt)<br>
            <strong>Время отправки:</strong> ${new Date().toISOString()}
          </div>
          <p>Все транзакционные уведомления (восстановление паролей, коды ПЭП по 63-ФЗ, системные алерты) теперь доставляются от официального доменного имени.</p>
          <a href="https://domexit.ru" class="btn">Перейти на DomExit.ru</a>
        </div>
      </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: emailFrom,
      to: ownerEmail,
      subject,
      html,
    });

    console.log('🎉 Diagnostic Email Dispatched Successfully!');
    console.log('  Message ID: ', info.messageId);
    console.log('  Accepted:   ', info.accepted);
    console.log('  Rejected:   ', info.rejected);
    console.log('  Response:   ', info.response);
  } catch (err) {
    console.error('✗ Failed to send email via Postbox:', err.message);
    if (err.response) console.error('  Server Response:', err.response);
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err.message);
  process.exit(1);
});
