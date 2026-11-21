import crypto from 'node:crypto';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, getClientIp } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { telegramClient, escapeHtml } from '../lib/telegramClient.js';
import { findTelegramBindingByUser } from '../lib/telegramWorkflow.js';
import { generatePepDocument, PepDocumentType } from '../lib/pepTemplates.js';
import { consumeQuota, recordSecurityIncident } from '../lib/anomalyDetector.js';
import { recordJournalEvent } from '../lib/journal.js';
import { logger } from '../lib/logger.js';

export async function handlePep(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const authUser = await getAuthenticatedUser(event);

  if (!authUser) {
    return json(event, 401, { error: 'Требуется авторизация' });
  }

  const ydb = getYdbClient();
  const cfg = getConfig();
  const clientIp = getClientIp(event);

  // 1. GET /api/pep/preview?documentType=...&lotCode=...
  if (subPath === '/preview' && method === 'GET') {
    const docType = (event.queryStringParameters?.documentType || 'nda_viewing_act') as PepDocumentType;
    const lotCode = (event.queryStringParameters?.lotCode || '').trim();

    if (!lotCode) {
      return json(event, 400, { error: 'Укажите параметр lotCode' });
    }

    const doc = generatePepDocument({
      documentType: docType,
      lotCode,
      userEmail: authUser.email,
      userName: authUser.name,
      userPhone: authUser.phone,
    });

    // Check if already signed
    let alreadySigned = false;
    let signatureRecord: any = null;

    try {
      const allSigs = await ydb.scanAll('pep_signatures', 300);
      signatureRecord =
        allSigs.find(
          (s: any) =>
            s.userId === authUser.id &&
            s.lotCode === lotCode &&
            s.documentType === docType &&
            s.status === 'signed'
        ) || null;
      alreadySigned = Boolean(signatureRecord);
    } catch (err: any) {
      logger.warn('Error checking existing pep signature', { meta: { error: err.message, lotCode } });
    }

    return json(event, 200, {
      ok: true,
      preview: doc,
      alreadySigned,
      signatureRecord,
    });
  }

  // 2. POST /api/pep/request-otp
  if (subPath === '/request-otp' && method === 'POST') {
    const body = parseBody<{ documentType?: PepDocumentType; lotCode?: string }>(event);
    const documentType = body?.documentType || 'nda_viewing_act';
    const lotCode = (body?.lotCode || '').trim();

    if (!lotCode) {
      return json(event, 400, { error: 'Укажите lotCode' });
    }

    // Rate Limit: 5 OTP requests / hour per user
    const quota = await consumeQuota({
      scope: 'pep_otp_request',
      actorKey: authUser.id,
      limit: 5,
      windowSec: 3600,
    });
    if (!quota.allowed) {
      return json(
        event,
        429,
        {
          error: 'Превышен лимит запросов кодов ПЭП (максимум 5 в час). Пожалуйста, подождите.',
          retryAfter: quota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(quota.retryAfterSec) } }
      );
    }

    // Check Telegram binding
    const binding = await findTelegramBindingByUser(authUser.id);
    if (!binding || !binding.chatId) {
      return json(event, 412, {
        error: 'Для подтверждения подписи кодом ПЭП (63-ФЗ) необходимо привязать Telegram-аккаунт.',
        code: 'TELEGRAM_NOT_LINKED',
      });
    }

    const doc = generatePepDocument({
      documentType,
      lotCode,
      userEmail: authUser.email,
      userName: authUser.name,
      userPhone: authUser.phone,
    });

    // Generate 6-digit random code and salt
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpSalt = crypto.randomBytes(16).toString('hex');
    const otpHash = crypto
      .createHash('sha256')
      .update(`${rawOtp}:${otpSalt}`)
      .digest('hex');

    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minutes
    const otpRecordKey = `otp:${authUser.id}:${documentType}:${lotCode}`;

    await ydb.putItem('pep_otps', {
      id: otpRecordKey,
      userId: authUser.id,
      documentType,
      lotCode,
      documentTextHashSha256: doc.documentTextHashSha256,
      otpSalt,
      otpHash,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      used: false,
    });

    // Send Telegram Notification with OTP
    const tgText = [
      `🔐 <b>КОД ПОДТВЕРЖДЕНИЯ ПЭП (63-ФЗ)</b>`,
      `Документ: <b>${escapeHtml(doc.documentTitle)}</b>`,
      `Объект: <code>#${escapeHtml(lotCode)}</code>`,
      ``,
      `Ваш одноразовый код: <code>${rawOtp}</code>`,
      `Срок действия: <b>5 минут</b>`,
      ``,
      `⚠️ <i>Никому не сообщайте этот код! Вводя его на портале DomExit, вы подписываете документ простой электронной подписью (ст. 5 и 9 Федерального закона № 63-ФЗ).</i>`,
    ].join('\n');

    try {
      await telegramClient.sendMessage({
        chat_id: binding.chatId,
        text: tgText,
      });
    } catch (tgErr: any) {
      logger.error('Failed to send Telegram OTP message', { meta: { error: tgErr.message, userId: authUser.id } });
      return json(event, 502, { error: 'Не удалось доставить код в Telegram. Проверьте активность бота.' });
    }

    return json(event, 200, {
      ok: true,
      expiresInSec: 300,
      documentTextHashSha256: doc.documentTextHashSha256,
      telegramUsername: binding.telegramUsername || null,
    });
  }

  // 3. POST /api/pep/verify-and-sign
  if (subPath === '/verify-and-sign' && method === 'POST') {
    const body = parseBody<{
      documentType?: PepDocumentType;
      lotCode?: string;
      otpCode?: string;
    }>(event);

    const documentType = body?.documentType || 'nda_viewing_act';
    const lotCode = (body?.lotCode || '').trim();
    const otpCode = String(body?.otpCode || '').trim();

    if (!lotCode || !otpCode) {
      return json(event, 400, { error: 'Укажите lotCode и otpCode' });
    }

    const otpRecordKey = `otp:${authUser.id}:${documentType}:${lotCode}`;
    const otpRecord = await ydb.getItem<any>('pep_otps', otpRecordKey);

    if (!otpRecord || otpRecord.used) {
      return json(event, 400, {
        error: 'Одноразовый код не запрашивался или уже был использован. Запросите новый код.',
      });
    }

    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return json(event, 400, {
        error: 'Срок действия одноразового кода истек (5 минут). Запросите новый код.',
      });
    }

    if (otpRecord.attempts >= 3) {
      return json(event, 423, {
        error: 'Превышено максимальное число попыток ввода (3). Код заблокирован.',
        locked: true,
      });
    }

    // Timing-safe Hash Comparison
    const candidateHash = crypto
      .createHash('sha256')
      .update(`${otpCode}:${otpRecord.otpSalt}`)
      .digest('hex');

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(candidateHash),
      Buffer.from(otpRecord.otpHash)
    );

    if (!isMatch) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      if (newAttempts >= 3) {
        await ydb.putItem('pep_otps', {
          ...otpRecord,
          attempts: newAttempts,
          used: true,
          lockedAt: new Date().toISOString(),
        });

        await recordSecurityIncident({
          type: 'pep_otp_bruteforce',
          severity: 'high',
          actorUserId: authUser.id,
          actorRole: authUser.role,
          clientIp,
          endpoint: '/api/pep/verify-and-sign',
          summary: `Блокировка попыток подбора кода ПЭП для документа ${documentType} лота #${lotCode}`,
          details: { documentType, lotCode, attempts: newAttempts },
        });

        return json(event, 423, {
          error: 'Превышено максимальное количество неверных попыток (3). Код аннулирован.',
          locked: true,
        });
      }

      await ydb.putItem('pep_otps', {
        ...otpRecord,
        attempts: newAttempts,
      });

      return json(event, 400, {
        error: `Неверный код. Осталось попыток: ${3 - newAttempts}.`,
        remainingAttempts: 3 - newAttempts,
      });
    }

    // OTP Verified! Mark used
    await ydb.putItem('pep_otps', {
      ...otpRecord,
      used: true,
      usedAt: new Date().toISOString(),
    });

    const doc = generatePepDocument({
      documentType,
      lotCode,
      userEmail: authUser.email,
      userName: authUser.name,
      userPhone: authUser.phone,
    });

    const sigId = `pep-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    const binding = await findTelegramBindingByUser(authUser.id);
    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16);
    const userAgentShort = String(
      event.headers?.['user-agent'] ||
        event.requestContext?.identity?.userAgent ||
        'Web Client'
    ).slice(0, 100);

    const signatureRecord = {
      id: sigId,
      documentType,
      documentVersion: '1.0',
      lotCode,
      userId: authUser.id,
      userRole: authUser.role,
      userEmail: authUser.email,
      userName: authUser.name,
      telegramChatId: binding?.chatId || undefined,
      telegramUsername: binding?.telegramUsername || undefined,
      documentTitle: doc.documentTitle,
      documentTextHashSha256: doc.documentTextHashSha256,
      signedAt: nowIso,
      ipHash,
      userAgentShort,
      verificationMethod: 'telegram_otp_63fz',
      status: 'signed',
    };

    // Save into YDB 'pep_signatures'
    await ydb.putItem('pep_signatures', signatureRecord);

    // Save into Immutable Journal in S3
    await recordJournalEvent({
      action: 'CREATE',
      collection: 'pep_signatures',
      recordId: sigId,
      actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
      payload: signatureRecord,
    });

    // Record user consent in user_consents table
    try {
      await ydb.putItem('user_consents', {
        id: `consent-${sigId}`,
        userId: authUser.id,
        userEmail: authUser.email,
        consentType: documentType,
        lotCode,
        signatureId: sigId,
        timestamp: nowIso,
      });
    } catch {}

    // Send Telegram Signed Receipt
    if (binding?.chatId) {
      const receiptText = [
        `✍️ <b>ДОКУМЕНТ УСПЕШНО ПОДПИСАН (ПЭП 63-ФЗ)</b>`,
        `Документ: <b>${escapeHtml(doc.documentTitle)}</b>`,
        `Объект: <code>#${escapeHtml(lotCode)}</code>`,
        `Реестровый номер: <code>${sigId}</code>`,
        `Хэш SHA-256: <code>${doc.documentTextHashSha256.substring(0, 16)}...</code>`,
        `Время подписи: <code>${new Date().toLocaleTimeString('ru-RU')} (MSK)</code>`,
        ``,
        `<i>Электронный акт сохранен в вашем личном кабинете DomExit и защищен неизменяемым реестром.</i>`,
      ].join('\n');

      void telegramClient.sendMessage({
        chat_id: binding.chatId,
        text: receiptText,
      });
    }

    return json(event, 200, {
      ok: true,
      success: true,
      signature: signatureRecord,
    });
  }

  // 4. GET /api/pep/my-signatures
  if (subPath === '/my-signatures' && method === 'GET') {
    const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
    const filterLotCode = event.queryStringParameters?.lotCode?.trim();

    const allSigs = await ydb.scanAll('pep_signatures', 500);
    let visible = isStaff
      ? allSigs
      : allSigs.filter((s: any) => s.userId === authUser.id);

    if (filterLotCode) {
      visible = visible.filter((s: any) => s.lotCode === filterLotCode);
    }

    return json(event, 200, {
      ok: true,
      total: visible.length,
      signatures: visible,
    });
  }

  return json(event, 404, { error: `Endpoint /api/pep${subPath} не найден` });
}
