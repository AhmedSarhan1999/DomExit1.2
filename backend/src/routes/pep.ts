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
import { sendEmail, renderPepOtpEmail, maskEmail } from '../lib/emailService.js';

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
      const userSigs = ydb.isV2TablesEnabled()
        ? await ydb.queryAllByIndex<any>({ tableName: 'pep_signatures', indexName: 'userId-signedAt-index', hashKey: 'userId', hashValue: authUser.id })
        : await ydb.scanAll('pep_signatures', 300);
      signatureRecord =
        userSigs.find(
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
    const body = parseBody<{
      documentType?: PepDocumentType;
      lotCode?: string;
      deliveryChannel?: 'email' | 'telegram' | 'both';
    }>(event);
    const documentType = body?.documentType || 'nda_viewing_act';
    const lotCode = (body?.lotCode || '').trim();
    const requestedChannel = body?.deliveryChannel || 'email';

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
    const hasTelegram = Boolean(binding?.chatId);

    if (requestedChannel === 'telegram' && !hasTelegram) {
      return json(event, 412, {
        error: 'Для подтверждения подписи через Telegram необходимо привязать Telegram-аккаунт.',
        code: 'TELEGRAM_NOT_LINKED',
      });
    }

    // Resolve effective delivery channel:
    // If 'both' was requested but no Telegram is bound, smoothly fall back to 'email'
    const effectiveChannel: 'email' | 'telegram' | 'both' =
      requestedChannel === 'both' ? (hasTelegram ? 'both' : 'email') : requestedChannel;

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
      deliveryChannel: effectiveChannel,
      otpSalt,
      otpHash,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      used: false,
    });

    let emailDelivered = false;
    let telegramDelivered = false;

    // 1. Deliver via Email (Default / Primary)
    if (effectiveChannel === 'email' || effectiveChannel === 'both') {
      try {
        const emailContent = renderPepOtpEmail({
          code: rawOtp,
          documentTitle: doc.documentTitle,
          lotCode,
          sha256Fingerprint: doc.documentTextHashSha256,
          expiresInMinutes: 5,
        });

        const sendRes = await sendEmail({
          to: authUser.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        emailDelivered = sendRes.success;
      } catch (emailErr: any) {
        logger.error('Failed to send PEP OTP email', {
          meta: { error: emailErr.message, userId: authUser.id },
        });
      }
    }

    // 2. Deliver via Telegram (Optional)
    if ((effectiveChannel === 'telegram' || effectiveChannel === 'both') && hasTelegram && binding?.chatId) {
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
        telegramDelivered = true;
      } catch (tgErr: any) {
        logger.error('Failed to send Telegram OTP message', {
          meta: { error: tgErr.message, userId: authUser.id },
        });
        if (effectiveChannel === 'telegram') {
          return json(event, 502, {
            error: 'Не удалось доставить код в Telegram. Попробуйте выбрать получение по email.',
          });
        }
      }
    }

    return json(event, 200, {
      ok: true,
      deliveryChannel: effectiveChannel,
      targetEmailMasked: maskEmail(authUser.email),
      telegramUsername: binding?.telegramUsername || null,
      emailDelivered,
      telegramDelivered,
      expiresInSec: 300,
      documentTextHashSha256: doc.documentTextHashSha256,
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

    const channelUsed = otpRecord.deliveryChannel || 'email';
    const verificationMethod =
      channelUsed === 'email'
        ? 'email_otp_63fz'
        : channelUsed === 'telegram'
        ? 'telegram_otp_63fz'
        : 'hybrid_otp_63fz';

    const signatureRecord = {
      id: sigId,
      documentType,
      documentVersion: '1.0',
      lotCode,
      userId: authUser.id,
      userRole: authUser.role,
      userEmail: authUser.email,
      userName: authUser.name,
      deliveryChannel: channelUsed,
      telegramChatId: binding?.chatId || undefined,
      telegramUsername: binding?.telegramUsername || undefined,
      documentTitle: doc.documentTitle,
      documentTextHashSha256: doc.documentTextHashSha256,
      signedAt: nowIso,
      ipHash,
      userAgentShort,
      verificationMethod,
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

      try {
        await telegramClient.sendMessage({
          chat_id: binding.chatId,
          text: receiptText,
        });
      } catch (err: any) {
        logger.warn('Failed to send PEP signed receipt via Telegram', {
          event: 'PEP_RECEIPT_TG_FAIL',
          meta: { error: err.message, sigId },
        });
      }
    }

    // Notify staff when buyer/seller signs deal PEP documents
    try {
      const users = ydb.isV2TablesEnabled()
        ? await Promise.all([
            ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' }),
            ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'employee' }),
          ]).then(([o, e]) => [...o, ...e])
        : await ydb.scanAll<any>('users', 200);
      const staffIds = (users || [])
        .filter((u: any) => u.role === 'owner' || u.role === 'employee')
        .map((u: any) => u.id);
      const staffNote =
        `✍️ <b>ПОДПИСАН ДОКУМЕНТ ПЭП (63-ФЗ): #${escapeHtml(lotCode)}</b>\n` +
        `Подписант: <b>${escapeHtml(authUser.name || authUser.email)}</b> (${escapeHtml(authUser.role)})\n` +
        `Документ: <b>${escapeHtml(doc.documentTitle)}</b>\n` +
        `Канал: <code>${escapeHtml(channelUsed)}</code> • SHA-256: <code>${doc.documentTextHashSha256.substring(0, 12)}...</code>`;
      for (const sid of staffIds) {
        const sb = await findTelegramBindingByUser(sid).catch(() => null);
        if (sb?.chatId) {
          await telegramClient.sendMessage({ chat_id: sb.chatId, text: staffNote }).catch(() => {});
        }
      }
    } catch {}

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

    let visible: any[] = [];
    if (ydb.isV2TablesEnabled()) {
      if (!isStaff) {
        visible = await ydb.queryAllByIndex<any>({ tableName: 'pep_signatures', indexName: 'userId-signedAt-index', hashKey: 'userId', hashValue: authUser.id, scanIndexForward: false });
      } else if (filterLotCode) {
        visible = await ydb.queryAllByIndex<any>({ tableName: 'pep_signatures', indexName: 'dealId-signedAt-index', hashKey: 'dealId', hashValue: filterLotCode, scanIndexForward: false });
      } else {
        visible = await ydb.scanAll('pep_signatures', 500);
      }
    } else {
      const allSigs = await ydb.scanAll('pep_signatures', 500);
      visible = isStaff
        ? allSigs
        : allSigs.filter((s: any) => s.userId === authUser.id);
    }

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
