import crypto from 'node:crypto';
import { getYdbClient } from './ydbClient.js';
import { telegramClient, escapeHtml } from './telegramClient.js';
import { memoryCache } from './memoryCache.js';
import { recordJournalEvent } from './journal.js';
import { logger } from './logger.js';
import { getConfig } from './config.js';

export const STAGE_LABELS: Record<string, string> = {
  intake_moderation: '📋 Первичный прием / Модерация',
  legal_audit: '⚖️ Юридический аудит',
  packaging: '📦 Упаковка и оценка',
  active: '🟢 Активен в каталоге',
  reserved: '🔒 Бронь / Подбор покупателя',
  deal_closing: '🏦 Сделка / Эскроу / Росреестр',
  sold: '🏆 Успешно закрыта',
  rejected: '⛔ Отклонено',
  cancelled: '🚫 Отменено',
};

export const STAGE_TRANSITIONS: Record<string, string[]> = {
  intake_moderation: ['legal_audit', 'rejected'],
  legal_audit: ['packaging', 'rejected'],
  packaging: ['active', 'rejected'],
  active: ['reserved', 'deal_closing', 'cancelled'],
  reserved: ['deal_closing', 'active', 'cancelled'],
  deal_closing: ['sold', 'active', 'cancelled'],
  sold: [],
  rejected: ['intake_moderation'],
  cancelled: ['active', 'intake_moderation'],
};

export function canTransitionStage(currentStage: string, targetStage: string): boolean {
  if (currentStage === targetStage) return true;
  const allowed = STAGE_TRANSITIONS[currentStage];
  return Array.isArray(allowed) && allowed.includes(targetStage);
}

export function enforceStagePermission(actor: { id?: string; role?: string; assignedEmployeeId?: string }, lot: any): void {
  if (actor.role === 'owner') return;

  if (actor.role === 'employee') {
    const isAssigned =
      lot.assignedEmployeeId === actor.id ||
      lot.assignedEmployeeId === actor.assignedEmployeeId ||
      lot.curatorId === actor.id;
    if (isAssigned) return;
  }

  throw new Error('Недостаточно прав для изменения этапа данного лота');
}

export async function findTelegramBindingByUser(userId: string): Promise<any | null> {
  const ydb = getYdbClient();
  return await ydb.getItem('telegram_bindings', `user:${userId}`);
}

export async function findTelegramBindingByChat(chatId: string | number): Promise<any | null> {
  const ydb = getYdbClient();
  return await ydb.getItem('telegram_bindings', `chat:${chatId}`);
}

export async function assignCuratorToLot(params: {
  lotCode: string;
  employeeId: string;
  actor: { id: string; role: string; name?: string; email?: string };
}): Promise<{ ok: boolean; lot: any; employee: any }> {
  const ydb = getYdbClient();
  const cfg = getConfig();
  const { lotCode, employeeId, actor } = params;

  if (actor.role !== 'owner' && actor.role !== 'employee') {
    throw new Error('Только владелец или куратор может назначать ответственного');
  }

  // 1. Fetch lot
  let lot = await ydb.getItem('lots', lotCode);
  if (!lot) {
    const allLots = await ydb.scanAll('lots', 500);
    lot = allLots.find((l: any) => l.lotCode === lotCode || l.id === lotCode || l.code === lotCode);
  }
  if (!lot) {
    throw new Error(`Лот #${lotCode} не найден`);
  }

  // 2. Fetch employee
  const employee = await ydb.getItem('employees', employeeId);
  if (!employee) {
    throw new Error(`Сотрудник ${employeeId} не найден`);
  }

  // 3. Update lot in YDB
  const updatedLot = {
    ...lot,
    assignedEmployeeId: employee.id,
    assignedEmployeeName: employee.name || 'Куратор DomExit',
    status: lot.status === 'intake_moderation' ? 'legal_audit' : lot.status,
    updatedAt: new Date().toISOString(),
  };
  await ydb.putItem('lots', updatedLot);

  // Invalidate cache
  memoryCache.invalidate('lots');

  // Audit log & journal
  try {
    await ydb.putItem('audit_logs', {
      id: `aud-${crypto.randomUUID()}`,
      action: 'ASSIGN_CURATOR',
      performedBy: actor.id,
      userEmail: actor.email,
      targetLotCode: lotCode,
      assignedEmployeeId: employee.id,
      timestamp: new Date().toISOString(),
    });
  } catch {}

  await recordJournalEvent({
    action: 'UPDATE',
    collection: 'lots',
    recordId: updatedLot.id,
    actor: { userId: actor.id, role: actor.role, email: actor.email },
    payload: { assignedEmployeeId: employee.id, status: updatedLot.status },
  });

  // 4. Send Interactive Task Card to Employee in Telegram
  try {
    // Find employee user binding
    const empUsers = await ydb.findByField('users', 'assignedEmployeeId', employee.id);
    const empUser = empUsers[0] || (await ydb.getItem('users', employee.id));
    if (empUser) {
      const binding = await findTelegramBindingByUser(empUser.id);
      if (binding && binding.chatId && binding.notificationsEnabled !== false) {
        const text = [
          `🔔 <b>Новая задача: Взят в работу лот #${escapeHtml(lotCode)}</b>`,
          `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b>`,
          `Город: <b>${escapeHtml(lot.city || 'spb')}</b>`,
          `Этап: <b>${escapeHtml(STAGE_LABELS[updatedLot.status] || updatedLot.status)}</b>`,
          `Продавец: <b>${escapeHtml(lot.sellerName || 'Скрыт (152-ФЗ)')}</b>`,
          ``,
          `👇 Выберите действие:`,
        ].join('\n');

        const webUrl = `${cfg.PUBLIC_BASE_URL}/admin/dashboard?lot=${encodeURIComponent(lotCode)}`;

        await telegramClient.sendMessage({
          chat_id: binding.chatId,
          text,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Принять в работу', callback_data: `accept:${lotCode}` },
                { text: '⏭ Перевести этап', callback_data: `stage_menu:${lotCode}` },
              ],
              [
                { text: '💬 Написать продавцу', callback_data: `reply:${lotCode}:seller_curator` },
                { text: '🌐 Открыть на сайте', url: webUrl },
              ],
            ],
          },
        });
      }
    }
  } catch (tgErr: any) {
    logger.warn('Failed to notify employee in Telegram', { meta: { error: tgErr.message } });
  }

  // 5. Notify Seller in Telegram
  try {
    if (lot.sellerUserId || lot.sellerId) {
      const sellerId = lot.sellerUserId || lot.sellerId;
      const sellerBinding = await findTelegramBindingByUser(sellerId);
      if (sellerBinding && sellerBinding.chatId && sellerBinding.notificationsEnabled !== false) {
        const sellerMsg = [
          `🤝 <b>По вашему лоту #${escapeHtml(lotCode)} назначен персональный куратор!</b>`,
          `Куратор: <b>${escapeHtml(employee.name || 'Специалист DomExit')}</b>`,
          `Телефон куратора: ${escapeHtml(employee.phone || '+7 (812) 900-00-01')}`,
          `Текущий статус: <b>${escapeHtml(STAGE_LABELS[updatedLot.status] || updatedLot.status)}</b>`,
        ].join('\n');

        await telegramClient.sendMessage({
          chat_id: sellerBinding.chatId,
          text: sellerMsg,
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Написать куратору', callback_data: `reply:${lotCode}:seller_curator` }],
            ],
          },
        });
      }
    }
  } catch (sellerErr: any) {
    logger.warn('Failed to notify seller in Telegram', { meta: { error: sellerErr.message } });
  }

  return { ok: true, lot: updatedLot, employee };
}

export async function transitionLotStage(params: {
  lotCode: string;
  nextStage: string;
  reason?: string;
  actor: { id: string; role: string; name?: string; email?: string; assignedEmployeeId?: string };
}): Promise<{ ok: boolean; lot: any; previousStage: string; currentStage: string }> {
  const ydb = getYdbClient();
  const cfg = getConfig();
  const { lotCode, nextStage, reason, actor } = params;

  // 1. Fetch lot
  let lot = await ydb.getItem('lots', lotCode);
  if (!lot) {
    const allLots = await ydb.scanAll('lots', 500);
    lot = allLots.find((l: any) => l.lotCode === lotCode || l.id === lotCode || l.code === lotCode);
  }
  if (!lot) {
    throw new Error(`Лот #${lotCode} не найден`);
  }

  // 2. Enforce permission
  enforceStagePermission(actor, lot);

  const prevStage = lot.status || 'intake_moderation';

  // Validate state machine transition
  if (!canTransitionStage(prevStage, nextStage) && actor.role !== 'owner') {
    throw new Error(`Переход из этапа "${STAGE_LABELS[prevStage] || prevStage}" в "${STAGE_LABELS[nextStage] || nextStage}" недопустим`);
  }

  // 3. Update lot in YDB
  const updatedLot = {
    ...lot,
    status: nextStage,
    stageReason: reason || undefined,
    stageUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // If moved to active, mark isApproved = true
  if (nextStage === 'active') {
    updatedLot.isApproved = true;
  }

  await ydb.putItem('lots', updatedLot);

  // Invalidate cache
  memoryCache.invalidate('lots');

  // Audit log & journal
  try {
    await ydb.putItem('audit_logs', {
      id: `aud-${crypto.randomUUID()}`,
      action: 'TRANSITION_STAGE',
      performedBy: actor.id,
      userEmail: actor.email,
      targetLotCode: lotCode,
      fromStage: prevStage,
      toStage: nextStage,
      reason,
      timestamp: new Date().toISOString(),
    });
  } catch {}

  await recordJournalEvent({
    action: 'UPDATE',
    collection: 'lots',
    recordId: updatedLot.id,
    actor: { userId: actor.id, role: actor.role, email: actor.email },
    payload: { status: nextStage, fromStage: prevStage, reason },
  });

  // 4. Send Telegram Notifications
  try {
    // Notify Seller
    const sellerId = lot.sellerUserId || lot.sellerId;
    if (sellerId) {
      const sellerBinding = await findTelegramBindingByUser(sellerId);
      if (sellerBinding && sellerBinding.chatId && sellerBinding.notificationsEnabled !== false) {
        const sellerMsg = [
          `📈 <b>Обновление статуса лота #${escapeHtml(lotCode)}</b>`,
          `Новый этап: <b>${escapeHtml(STAGE_LABELS[nextStage] || nextStage)}</b>`,
          reason ? `Комментарий: <i>${escapeHtml(reason)}</i>` : '',
          ``,
          `Куратор сделки работает над оформлением. Вы можете задать вопрос в чате.`,
        ].filter(Boolean).join('\n');

        await telegramClient.sendMessage({
          chat_id: sellerBinding.chatId,
          text: sellerMsg,
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Чат с куратором', callback_data: `reply:${lotCode}:seller_curator` }],
              [{ text: '🌐 Открыть портал', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
            ],
          },
        });
      }
    }

    // Notify Buyer if deal exists
    const buyerId = lot.buyerUserId || lot.buyerId;
    if (buyerId) {
      const buyerBinding = await findTelegramBindingByUser(buyerId);
      if (buyerBinding && buyerBinding.chatId && buyerBinding.notificationsEnabled !== false) {
        const buyerMsg = [
          `📑 <b>Статус по вашей сделке #${escapeHtml(lotCode)} обновлен</b>`,
          `Текущий этап: <b>${escapeHtml(STAGE_LABELS[nextStage] || nextStage)}</b>`,
        ].join('\n');

        await telegramClient.sendMessage({
          chat_id: buyerBinding.chatId,
          text: buyerMsg,
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Чат с менеджером', callback_data: `reply:${lotCode}:buyer_curator` }],
              [{ text: '🌐 Кабинет сделки', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
            ],
          },
        });
      }
    }
  } catch (notifyErr: any) {
    logger.warn('Non-fatal error in transition Telegram notifications', { meta: { error: notifyErr.message } });
  }

  return { ok: true, lot: updatedLot, previousStage: prevStage, currentStage: nextStage };
}

export async function relayBridgedMessage(params: {
  lotCode: string;
  dealId?: string;
  threadChannel: 'seller_curator' | 'buyer_curator';
  senderUser: { id: string; role: string; name: string };
  text: string;
  source: 'web' | 'telegram';
}): Promise<{ ok: boolean; messageId: string }> {
  const ydb = getYdbClient();
  const { lotCode, dealId, threadChannel, senderUser, text, source } = params;

  const msgId = `msg-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // 1. Save message in curator_messages
  const msgRecord = {
    id: msgId,
    lotCode,
    dealId: dealId || undefined,
    threadChannel,
    senderId: senderUser.id,
    senderName: senderUser.name,
    role: senderUser.role,
    text,
    source,
    createdAt: now,
  };

  await ydb.putItem('curator_messages', msgRecord);

  // 2. Identify Recipient
  let lot = await ydb.getItem('lots', lotCode);
  if (!lot) {
    const allLots = await ydb.scanAll('lots', 500);
    lot = allLots.find((l: any) => l.lotCode === lotCode || l.id === lotCode);
  }

  let recipientUserId: string | null = null;
  const isSenderStaff = senderUser.role === 'owner' || senderUser.role === 'employee';

  if (isSenderStaff) {
    // Recipient is seller or buyer
    if (threadChannel === 'seller_curator') {
      recipientUserId = lot?.sellerUserId || lot?.sellerId || null;
    } else {
      recipientUserId = lot?.buyerUserId || lot?.buyerId || null;
    }
  } else {
    // Recipient is assigned curator or owner
    if (lot?.assignedEmployeeId) {
      const empUsers = await ydb.findByField('users', 'assignedEmployeeId', lot.assignedEmployeeId);
      recipientUserId = empUsers[0]?.id || null;
    }
    if (!recipientUserId) {
      // Fallback to platform owner
      const owners = await ydb.findByField('users', 'role', 'owner');
      recipientUserId = owners[0]?.id || null;
    }
  }

  // 3. Relay to Telegram if recipient is bound
  if (recipientUserId) {
    try {
      const binding = await findTelegramBindingByUser(recipientUserId);
      if (binding && binding.chatId && binding.notificationsEnabled !== false) {
        const channelTitle = threadChannel === 'seller_curator' ? 'Чат с продавцом' : 'Чат с покупателем';
        const tgText = [
          `💬 <b>${channelTitle} [Лот #${escapeHtml(lotCode)}]</b>`,
          `От: <b>${escapeHtml(senderUser.name)}</b>`,
          ``,
          `${escapeHtml(text)}`,
        ].join('\n');

        const sendRes = await telegramClient.sendMessage({
          chat_id: binding.chatId,
          text: tgText,
          reply_markup: {
            inline_keyboard: [
              [{ text: '↩️ Ответить в чат', callback_data: `reply:${lotCode}:${threadChannel}` }],
            ],
          },
        });

        if (sendRes?.ok && sendRes.result?.message_id) {
          // Store mapping for native Telegram reply
          await ydb.putItem('telegram_message_map', {
            id: `msg:${binding.chatId}:${sendRes.result.message_id}`,
            lotCode,
            dealId: dealId || '',
            threadChannel,
            senderUserId: senderUser.id,
            targetUserId: recipientUserId,
            targetRole: senderUser.role,
            createdAt: now,
          });
        }
      }
    } catch (relayErr: any) {
      logger.warn('Failed relaying message to Telegram', { meta: { error: relayErr.message } });
    }
  }

  return { ok: true, messageId: msgId };
}
