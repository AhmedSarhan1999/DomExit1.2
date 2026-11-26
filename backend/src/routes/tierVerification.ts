import crypto from 'node:crypto';
import {
  YcHttpEvent,
  YcHttpResponse,
  BuyerBuyBox,
  TierVerificationRequest,
  TierVerificationProofType,
  TierVerificationStatus,
  UserProfile,
} from '../types.js';
import { json, parseBody } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser, invalidateAuthUserCache } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { memoryCache } from '../lib/memoryCache.js';
import { getUnifiedBuyBox, syncBuyBoxAndUser } from '../lib/buyBoxSync.js';
import { recordJournalEvent } from '../lib/journal.js';
import { callTelegramApi, escapeHtml } from '../lib/telegramClient.js';
import { findTelegramBindingByUser } from '../lib/telegramWorkflow.js';
import { createPresignedDownloadUrl } from '../lib/s3Client.js';
import { logger } from '../lib/logger.js';

const ALLOWED_PROOF_TYPES = new Set<TierVerificationProofType>([
  'cash_100_statement',
  'mortgage_approval',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_PROOF_SIZE = 15 * 1024 * 1024; // 15MB

async function notifyStaff(text: string): Promise<void> {
  try {
    const ydb = getYdbClient();
    const users = await ydb.scanAll<UserProfile>('users', 200);
    const staff = (users || []).filter((u) => u.role === 'owner' || u.role === 'employee');
    for (const member of staff) {
      const binding = await findTelegramBindingByUser(member.id);
      if (binding && binding.chatId && binding.notificationsEnabled !== false) {
        await callTelegramApi('sendMessage', {
          chat_id: binding.chatId,
          text,
          parse_mode: 'HTML',
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.warn('Failed to send staff telegram notification', { meta: { error: err.message } });
  }
}

async function notifyUserTelegram(userId: string, text: string): Promise<void> {
  try {
    const binding = await findTelegramBindingByUser(userId);
    if (binding && binding.chatId && binding.notificationsEnabled !== false) {
      await callTelegramApi('sendMessage', {
        chat_id: binding.chatId,
        text,
        parse_mode: 'HTML',
      }).catch(() => {});
    }
  } catch (err: any) {
    logger.warn('Failed to send user telegram notification', { meta: { error: err.message, userId } });
  }
}

export async function handleTierVerification(
  event: YcHttpEvent,
  subPath: string
): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const ydb = getYdbClient();
  const cfg = getConfig();
  const authUser = await getAuthenticatedUser(event);

  if (!authUser) {
    return json(event, 401, { error: 'Требуется авторизация' });
  }

  const isStaff = authUser.role === 'owner' || authUser.role === 'employee';

  // =========================================================================
  // 1. GET /api/tier-requests/my (Current Client's Verification Requests)
  // =========================================================================
  if (subPath === '/my' && method === 'GET') {
    try {
      const allRequests = await ydb.scanAll<TierVerificationRequest>('tier_verification_requests', 200);
      const userRequests = (allRequests || [])
        .filter((r) => r.userId === authUser.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      return json(event, 200, {
        ok: true,
        requests: userRequests,
        currentRequest: userRequests[0] || null,
      });
    } catch (err: any) {
      logger.error('Error fetching client tier requests', { meta: { error: err.message, userId: authUser.id } });
      return json(event, 500, { error: 'Не удалось загрузить статус верификации' });
    }
  }

  // =========================================================================
  // 2. POST /api/tier-requests (Client Submits Gold Upgrade Request)
  // =========================================================================
  if ((subPath === '' || subPath === '/') && method === 'POST') {
    const body = parseBody<{
      proofType: TierVerificationProofType;
      declaredBudgetRub: number;
      documentKey: string;
      documentName: string;
      documentMime?: string;
      documentSize?: number;
      comment?: string;
    }>(event);

    if (!body?.proofType || !ALLOWED_PROOF_TYPES.has(body.proofType)) {
      return json(event, 400, {
        error: 'Укажите тип подтверждения: cash_100_statement (выписка 100% средств) или mortgage_approval (одобрение ипотеки)',
      });
    }

    const declaredBudget = Number(body.declaredBudgetRub);
    if (!declaredBudget || declaredBudget <= 0) {
      return json(event, 400, { error: 'Укажите корректный заявленный бюджет (больше 0 ₽)' });
    }

    if (!body.documentKey || typeof body.documentKey !== 'string') {
      return json(event, 400, { error: 'Не указан ключ подтверждающего документа (documentKey)' });
    }

    if (!body.documentName || typeof body.documentName !== 'string') {
      return json(event, 400, { error: 'Не указано имя файла документа' });
    }

    const mime = (body.documentMime || 'application/pdf').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return json(event, 400, {
        error: 'Недопустимый формат файла. Разрешены PDF, JPEG, PNG, WebP.',
      });
    }

    const size = Number(body.documentSize || 0);
    if (size > MAX_PROOF_SIZE) {
      return json(event, 400, { error: 'Размер документа превышает лимит 15 МБ' });
    }

    try {
      // Check if user already has Gold tier
      const bb = await ydb.getItem<BuyerBuyBox>('buy_boxes', `bb:${authUser.id}`);
      if (bb && bb.tier === 'gold') {
        return json(event, 400, { error: 'У вас уже подтвержден инвестиционный статус Gold' });
      }

      // Check if user already has a pending request
      const allRequests = await ydb.scanAll<TierVerificationRequest>('tier_verification_requests', 200);
      const existingPending = (allRequests || []).find(
        (r) => r.userId === authUser.id && r.status === 'pending'
      );
      if (existingPending) {
        return json(event, 400, {
          error: 'Заявка на верификацию статуса Gold уже находится на рассмотрении куратора',
          pendingRequestId: existingPending.id,
        });
      }

      const id = `tvr-${crypto.randomUUID().substring(0, 12)}`;
      const now = new Date().toISOString();
      const currentTier = bb?.tier || 'silver';

      const newRequest: TierVerificationRequest = {
        id,
        userId: authUser.id,
        userName: authUser.name || authUser.email,
        userEmail: authUser.email,
        currentTier,
        requestedTier: 'gold',
        proofType: body.proofType,
        declaredBudgetRub: Math.round(declaredBudget),
        documentKey: body.documentKey.trim(),
        documentName: body.documentName.trim(),
        documentMime: mime,
        documentSize: size,
        comment: (body.comment || '').trim().substring(0, 500) || undefined,
        status: 'pending',
        createdAt: now,
      };

      await ydb.putItem('tier_verification_requests', newRequest);

      // Notify staff in Telegram
      const proofTitle =
        body.proofType === 'cash_100_statement'
          ? 'Выписка со счета (100% собственные средства)'
          : 'Одобрение ипотеки банка';

      await notifyStaff(
        `⚡️ <b>Новая заявка на статус Gold</b>\n` +
        `Покупатель: <b>${escapeHtml(authUser.name || authUser.email)}</b>\n` +
        `Email: <code>${escapeHtml(authUser.email)}</code>\n` +
        `Тип подтверждения: <b>${escapeHtml(proofTitle)}</b>\n` +
        `Заявленный бюджет: <b>${newRequest.declaredBudgetRub.toLocaleString('ru-RU')} ₽</b>\n` +
        `ID заявки: <code>${id}</code>\n` +
        (newRequest.comment ? `Комментарий: <i>${escapeHtml(newRequest.comment)}</i>\n` : '') +
        `\n<i>Проверьте документ в панели куратора «Верификация статуса Gold».</i>`
      );

      return json(event, 201, {
        ok: true,
        request: newRequest,
        message: 'Заявка на получение статуса Gold успешно отправлена на рассмотрение куратора',
      });
    } catch (err: any) {
      logger.error('Error submitting tier verification request', { meta: { error: err.message, userId: authUser.id } });
      return json(event, 500, { error: 'Не удалось отправить заявку на верификацию' });
    }
  }

  // =========================================================================
  // 3. GET /api/tier-requests (Admin/Curator: List with status filter & pagination)
  // =========================================================================
  if ((subPath === '' || subPath === '/') && method === 'GET') {
    if (!isStaff) {
      return json(event, 403, { error: 'Доступ разрешен только сотрудникам платформы' });
    }

    const query = event.queryStringParameters || {};
    const statusParam = (query['status'] || 'pending').toLowerCase();
    const page = Math.max(1, parseInt(query['page'] || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query['limit'] || '25', 10) || 25));

    try {
      const allRequests = await ydb.scanAll<TierVerificationRequest>('tier_verification_requests', 500);

      const filtered = (allRequests || []).filter((r) => {
        if (statusParam === 'archive') {
          return r.status === 'approved' || r.status === 'rejected';
        }
        return r.status === 'pending';
      });

      // Sort: Pending -> oldest first or newest first; Archive -> newest reviewed first
      if (statusParam === 'archive') {
        filtered.sort((a, b) => (b.reviewedAt || b.createdAt).localeCompare(a.reviewedAt || a.createdAt));
      } else {
        filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const items = filtered.slice(startIndex, startIndex + limit);

      return json(event, 200, {
        ok: true,
        items,
        total,
        page,
        limit,
        totalPages,
      });
    } catch (err: any) {
      logger.error('Error fetching admin tier requests', { meta: { error: err.message } });
      return json(event, 500, { error: 'Не удалось загрузить список заявок' });
    }
  }

  // =========================================================================
  // 4. GET /api/tier-requests/:id/document-url (5-minute presigned download URL)
  // =========================================================================
  const docMatch = subPath.match(/^\/([^/]+)\/document-url$/);
  if (docMatch && method === 'GET') {
    const requestId = docMatch[1];
    try {
      const req = await ydb.getItem<TierVerificationRequest>('tier_verification_requests', requestId);
      if (!req) {
        return json(event, 404, { error: 'Заявка на верификацию не найдена' });
      }

      // Security check: Only staff or the client who submitted can access the private document
      if (!isStaff && req.userId !== authUser.id) {
        return json(event, 403, { error: 'У вас нет доступа к документу этой заявки' });
      }

      const downloadUrl = await createPresignedDownloadUrl({
        bucket: cfg.S3_PRIVATE_BUCKET,
        key: req.documentKey,
        originalFilename: req.documentName,
        expiresInSeconds: 300,
      });

      return json(event, 200, {
        ok: true,
        downloadUrl,
        expiresIn: 300,
        filename: req.documentName,
      });
    } catch (err: any) {
      logger.error('Error generating document presigned url', { meta: { error: err.message, requestId } });
      return json(event, 500, { error: 'Не удалось сгенерировать ссылку на документ' });
    }
  }

  // =========================================================================
  // 5. POST /api/tier-requests/:id/decision (Admin/Curator Approval or Rejection)
  // =========================================================================
  const decisionMatch = subPath.match(/^\/([^/]+)\/decision$/);
  if (decisionMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Принятие решений по верификации доступно только сотрудникам' });
    }

    const requestId = decisionMatch[1];
    const body = parseBody<{
      decision: 'approved' | 'rejected';
      reviewNote?: string;
    }>(event);

    if (!body?.decision || (body.decision !== 'approved' && body.decision !== 'rejected')) {
      return json(event, 400, { error: 'Укажите решение decision: approved или rejected' });
    }

    const reviewNote = (body.reviewNote || '').trim();
    if (body.decision === 'rejected' && reviewNote.length < 3) {
      return json(event, 400, {
        error: 'При отклонении заявки обязательно укажите причину отказа (минимум 3 символа)',
      });
    }

    try {
      const req = await ydb.getItem<TierVerificationRequest>('tier_verification_requests', requestId);
      if (!req) {
        return json(event, 404, { error: 'Заявка не найдена' });
      }

      if (req.status !== 'pending') {
        return json(event, 400, {
          error: `Заявка уже была рассмотрена ранее (текущий статус: ${req.status})`,
        });
      }

      const now = new Date().toISOString();
      req.status = body.decision;
      req.reviewedBy = authUser.id;
      req.reviewedByName = authUser.name || authUser.email;
      req.reviewedAt = now;
      req.reviewNote = reviewNote || undefined;

      await ydb.putItem('tier_verification_requests', req);

      if (body.decision === 'approved') {
        // Upgrade unified Buy-Box and User record to Gold
        const existingBb = await getUnifiedBuyBox(ydb, req.userId);
        const updatedBb: BuyerBuyBox = existingBb || {
          id: `bb:${req.userId}`,
          userId: req.userId,
          active: true,
          cities: ['spb'],
          districts: [],
          complexNames: [],
          dealTracks: ['ddu_cession'],
          rooms: [],
          maxBudgetRub: req.declaredBudgetRub || 20000000,
          minDiscountPercent: 10,
          paymentMethod: req.proofType === 'mortgage_approval' ? 'standard_mortgage_approved' : 'cash_100',
          preferredBanks: [],
          goal: 'living',
          readinessHours: 24,
          tier: 'gold',
          reliabilityScore: 100,
          noShowCount: 0,
          completedViewingsCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        updatedBb.tier = 'gold';
        updatedBb.tierVerifiedAt = now;
        updatedBb.tierVerifiedBy = authUser.email;
        updatedBb.tierNote = `Верифицирован статус Gold по заявке ${req.id} (${req.proofType === 'cash_100_statement' ? 'Выписка 100% средств' : 'Одобрение ипотеки'})`;
        if (req.declaredBudgetRub) {
          updatedBb.availableLiquidityRub = req.declaredBudgetRub;
        }
        updatedBb.updatedAt = now;

        await syncBuyBoxAndUser(ydb, req.userId, updatedBb);
        invalidateAuthUserCache(req.userId);

        // Audit log entry
        await ydb.putItem('audit_logs', {
          id: `log-${crypto.randomUUID()}`,
          timestamp: now,
          operatorId: authUser.id,
          operatorName: authUser.name || authUser.email,
          operatorRole: authUser.role === 'owner' ? 'owner' : 'curator',
          actionType: 'tier_upgrade_approved',
          title: `Одобрен статус Gold для ${req.userName || req.userEmail}`,
          description: `Заявка ${req.id} одобрена. Бюджет: ${req.declaredBudgetRub.toLocaleString('ru-RU')} ₽, подтверждение: ${req.proofType === 'cash_100_statement' ? 'Выписка со счета (100% средств)' : 'Одобрение ипотеки банка'}.`,
          performedBy: authUser.id,
          userEmail: authUser.email,
          action: 'TIER_UPGRADE_APPROVED',
          metadata: {
            requestId: req.id,
            userId: req.userId,
            proofType: req.proofType,
            declaredBudgetRub: req.declaredBudgetRub,
            documentKey: req.documentKey,
            reviewedBy: authUser.email,
          },
        });

        await recordJournalEvent({
          action: 'UPDATE',
          collection: 'buy_boxes',
          recordId: updatedBb.id,
          actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
          payload: { tier: 'gold', declaredBudgetRub: req.declaredBudgetRub, requestId: req.id },
        });

        // Notify client via Telegram
        await notifyUserTelegram(
          req.userId,
          `🎉 <b>Ваш инвестиционный статус повышен до GOLD!</b>\n\n` +
          `Куратор проверил предоставленные документы и подтвердил ваш статус <b>Gold</b>.\n` +
          `Теперь вам открыт эксклюзивный приоритетный доступ к закрытым лотам платформы (Стадия P1).\n\n` +
          `Удачных инвестиций на DomExit!`
        );
      } else {
        // Rejected
        await ydb.putItem('audit_logs', {
          id: `log-${crypto.randomUUID()}`,
          timestamp: now,
          operatorId: authUser.id,
          operatorName: authUser.name || authUser.email,
          operatorRole: authUser.role === 'owner' ? 'owner' : 'curator',
          actionType: 'tier_upgrade_rejected',
          title: `Отклонена заявка на Gold для ${req.userName || req.userEmail}`,
          description: `Заявка ${req.id} отклонена. Причина: ${reviewNote}`,
          performedBy: authUser.id,
          userEmail: authUser.email,
          action: 'TIER_UPGRADE_REJECTED',
          metadata: {
            requestId: req.id,
            userId: req.userId,
            reason: reviewNote,
            reviewedBy: authUser.email,
          },
        });

        await recordJournalEvent({
          action: 'UPDATE',
          collection: 'tier_verification_requests',
          recordId: req.id,
          actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
          payload: { status: 'rejected', reason: reviewNote },
        });

        // Notify client via Telegram
        await notifyUserTelegram(
          req.userId,
          `ℹ️ <b>Статус заявки на верификацию Gold</b>\n\n` +
          `Куратор рассмотрел вашу заявку на повышение статуса до Gold.\n` +
          `К сожалению, заявка отклонена.\n` +
          `<b>Причина отказа:</b> <i>${escapeHtml(reviewNote)}</i>\n\n` +
          `Вы можете устранить замечания и подать новую заявку с обновленными документами в личном кабинете.`
        );
      }

      return json(event, 200, {
        ok: true,
        request: req,
        message: body.decision === 'approved' ? 'Заявка одобрена, статус Gold присвоен' : 'Заявка отклонена',
      });
    } catch (err: any) {
      logger.error('Error processing tier verification decision', { meta: { error: err.message, requestId } });
      return json(event, 500, { error: 'Не удалось обработать решение по заявке' });
    }
  }

  return json(event, 404, { error: `Endpoint /api/tier-requests${subPath} не найден` });
}
