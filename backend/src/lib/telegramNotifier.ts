import crypto from 'node:crypto';
import { getYdbClient } from './ydbClient.js';
import { telegramClient, escapeHtml } from './telegramClient.js';
import { findTelegramBindingByUser, relayBridgedMessage, STAGE_LABELS } from './telegramWorkflow.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';

function formatPrice(val: any): string {
  const n = Number(val);
  if (isNaN(n) || n === 0) return 'По запросу';
  return n.toLocaleString('ru-RU');
}

async function getOwnerChatIds(): Promise<string[]> {
  try {
    const ydb = getYdbClient();
    const users = ydb.isV2TablesEnabled()
      ? await ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' })
      : await ydb.scanAll('users', 200);
    const owners = users.filter((u: any) => u.role === 'owner' || u.activeRole === 'owner');
    const chatIds: string[] = [];

    for (const member of owners) {
      const binding = await findTelegramBindingByUser(member.id);
      if (binding && binding.chatId && binding.notificationsEnabled !== false) {
        chatIds.push(String(binding.chatId));
      }
    }
    return [...new Set(chatIds)];
  } catch (err: any) {
    logger.warn('Failed to retrieve owner chat IDs', { meta: { error: err.message } });
    return [];
  }
}

async function getAssignedStaffChatIds(
  assignedEmployeeId?: string,
  includeOwners = true
): Promise<string[]> {
  try {
    const ydb = getYdbClient();
    const users = ydb.isV2TablesEnabled()
      ? await Promise.all([
          ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' }),
          ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'employee' }),
        ]).then(([o, e]) => [...o, ...e])
      : await ydb.scanAll('users', 200);
    const targetId = String(assignedEmployeeId || '').trim();
    const recipients = users.filter((u: any) => {
      const isOwner = u.role === 'owner' || u.activeRole === 'owner';
      if (includeOwners && isOwner) return true;
      if (!targetId) return false;
      const isEmployee = u.role === 'employee' || u.activeRole === 'employee';
      if (!isEmployee && !isOwner) return false;
      return String(u.id) === targetId || String(u.assignedEmployeeId || '') === targetId;
    });

    const chatIds: string[] = [];
    for (const member of recipients) {
      const binding = await findTelegramBindingByUser(member.id);
      if (binding && binding.chatId && binding.notificationsEnabled !== false) {
        chatIds.push(String(binding.chatId));
      }
    }
    return [...new Set(chatIds)];
  } catch (err: any) {
    logger.warn('Failed to retrieve assigned staff chat IDs', { meta: { error: err.message } });
    return [];
  }
}

async function resolveLotAssignedEmployeeId(lotCode?: string): Promise<string | undefined> {
  if (!lotCode) return undefined;
  try {
    const ydb = getYdbClient();
    const clean = String(lotCode).trim().toUpperCase();
    let lot: any = null;
    if (ydb.isV2TablesEnabled()) {
      lot =
        (await ydb.getItem<any>('lots', String(lotCode).trim()).catch(() => null)) ||
        (await ydb.queryAllByIndex<any>({ tableName: 'lots', indexName: 'lotCode-index', hashKey: 'lotCode', hashValue: clean, limit: 5 }))[0] ||
        null;
    } else {
      const allLots = await ydb.scanAll<any>('lots', 500);
      lot = (allLots || []).find(
        (l: any) => String(l.lotCode || l.id || '').trim().toUpperCase() === clean
      );
    }
    return lot?.assignedEmployeeId || lot?.assignedCuratorId || undefined;
  } catch {
    return undefined;
  }
}

export const telegramNotifier = {
  notifyNewSellerSubmission: async (item: Record<string, any>) => {
    try {
      if (!telegramClient.isConfigured()) return;
      const cfg = getConfig();
      const code = item.lotCode || item.code || item.id || 'NEW';
      const assignedEmpId = item.assignedEmployeeId || item.assignedCuratorId;
      const staffChats = assignedEmpId
        ? await getAssignedStaffChatIds(assignedEmpId, true)
        : await getOwnerChatIds();

      if (staffChats.length === 0) return;

      const title = `📥 <b>Новая заявка на продажу [Лот #${escapeHtml(code)}]</b>`;
      const complex = item.complexName || item.title || 'Не указан';
      const city = item.city === 'msk' ? 'Москва' : 'Санкт-Петербург';
      const price = formatPrice(item.price || item.targetPrice);
      const urgency = item.urgency === 'urgent' ? '⚡ Срочная (выкуп 24ч)' : 'Стандартная';

      const text = [
        title,
        `ЖК: <b>${escapeHtml(complex)}</b>`,
        `Город: <b>${escapeHtml(city)}</b>`,
        `Ожидаемая цена: <b>${escapeHtml(price)} ₽</b>`,
        `Срочность: <b>${escapeHtml(urgency)}</b>`,
        item.rooms ? `Комнат: <b>${escapeHtml(String(item.rooms))}</b>` : '',
        item.area ? `Площадь: <b>${escapeHtml(String(item.area))} м²</b>` : '',
        ``,
        `👇 Назначьте ответственного или возьмите в работу:`,
      ].filter(Boolean).join('\n');

      const webUrl = `${cfg.PUBLIC_BASE_URL}/admin/dashboard?lot=${encodeURIComponent(code)}`;

      for (const chatId of staffChats) {
        await telegramClient.sendMessage({
          chat_id: chatId,
          text,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Взять в работу', callback_data: `accept:${code}` },
                { text: '🌐 Открыть на сайте', url: webUrl },
              ],
            ],
          },
        });
      }
    } catch (err: any) {
      logger.warn('Error in notifyNewSellerSubmission', { meta: { error: err.message } });
    }
  },

  notifyNewBuyerApplication: async (app: Record<string, any>) => {
    try {
      if (!telegramClient.isConfigured()) return;
      const cfg = getConfig();
      const code = app.lotCode || app.lotId || 'GENERAL';
      const assignedEmpId =
        app.assignedEmployeeId || (await resolveLotAssignedEmployeeId(code));
      const staffChats = await getAssignedStaffChatIds(assignedEmpId, !assignedEmpId);

      if (staffChats.length === 0) return;

      const title = `🎯 <b>Новая заявка покупателя [Лот #${escapeHtml(code)}]</b>`;
      const name = app.clientName || app.name || 'Покупатель';
      const paymentMethod = app.paymentMethod === 'mortgage' ? 'Ипотека / Эскроу' : '100% Оплата / Наличные';
      const budget = formatPrice(app.offeredPrice || app.budget || app.price);

      const text = [
        title,
        `Покупатель: <b>${escapeHtml(name)}</b>`,
        `Способ оплаты: <b>${escapeHtml(paymentMethod)}</b>`,
        budget !== 'По запросу' ? `Предложенная сумма: <b>${escapeHtml(budget)} ₽</b>` : '',
        app.comment ? `Комментарий: <i>${escapeHtml(app.comment)}</i>` : '',
        ``,
        `Кураторы могут связаться с покупателем в кабинете сделки.`,
      ].filter(Boolean).join('\n');

      const webUrl = `${cfg.PUBLIC_BASE_URL}/admin/dashboard?tab=deals&lot=${encodeURIComponent(code)}`;

      for (const chatId of staffChats) {
        await telegramClient.sendMessage({
          chat_id: chatId,
          text,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💬 Чат по сделке', callback_data: `reply:${code}:buyer_curator` },
                { text: '🌐 Открыть сделку', url: webUrl },
              ],
            ],
          },
        });
      }
    } catch (err: any) {
      logger.warn('Error in notifyNewBuyerApplication', { meta: { error: err.message } });
    }
  },

  notifyNewPartnerOrInvestor: async (type: 'partner' | 'investor', app: Record<string, any>) => {
    try {
      if (!telegramClient.isConfigured()) return;
      const cfg = getConfig();
      const staffChats = await getOwnerChatIds();
      if (staffChats.length === 0) return;

      const isPart = type === 'partner';
      const title = isPart
        ? `🤝 <b>Новая заявка на партнерство (Агент / Брокер)</b>`
        : `💼 <b>Новая заявка в пул соинвесторов DomExit</b>`;

      const name = app.name || app.fullName || 'Кандидат';
      const company = app.company || app.agencyName || app.strategy || 'Частное лицо';
      const city = app.city === 'msk' ? 'Москва' : 'Санкт-Петербург';

      const text = [
        title,
        `ФИО / Контакт: <b>${escapeHtml(name)}</b>`,
        `Организация / Опыт: <b>${escapeHtml(company)}</b>`,
        `Город: <b>${escapeHtml(city)}</b>`,
        app.budget ? `Планируемый капитал: <b>${escapeHtml(formatPrice(app.budget))} ₽</b>` : '',
        app.comment ? `Заметка: <i>${escapeHtml(app.comment)}</i>` : '',
      ].filter(Boolean).join('\n');

      const webUrl = `${cfg.PUBLIC_BASE_URL}/admin/dashboard?tab=partners`;

      for (const chatId of staffChats) {
        await telegramClient.sendMessage({
          chat_id: chatId,
          text,
          reply_markup: {
            inline_keyboard: [[{ text: '🌐 Открыть в админке', url: webUrl }]],
          },
        });
      }
    } catch (err: any) {
      logger.warn('Error in notifyNewPartnerOrInvestor', { meta: { error: err.message } });
    }
  },

  notifyLotStageChanged: async (params: {
    lotCode: string;
    previousStage: string;
    newStage: string;
    actor: { id: string; role: string; name?: string };
  }) => {
    try {
      if (!telegramClient.isConfigured()) return;
      const { lotCode, previousStage, newStage, actor } = params;
      const assignedEmpId = await resolveLotAssignedEmployeeId(lotCode);
      const isClosingOrCritical = newStage === 'closing_escrow' || newStage === 'completed';
      const staffChats = await getAssignedStaffChatIds(assignedEmpId, isClosingOrCritical || !assignedEmpId);

      const text = [
        `🔄 <b>Смена этапа лота #${escapeHtml(lotCode)}</b>`,
        `Было: <b>${escapeHtml(STAGE_LABELS[previousStage] || previousStage)}</b>`,
        `Стало: <b>${escapeHtml(STAGE_LABELS[newStage] || newStage)}</b>`,
        `Инициатор: <b>${escapeHtml(actor.name || actor.role)}</b>`,
      ].join('\n');

      for (const chatId of staffChats) {
        await telegramClient.sendMessage({
          chat_id: chatId,
          text,
        });
      }
    } catch (err: any) {
      logger.warn('Error in notifyLotStageChanged', { meta: { error: err.message } });
    }
  },

  handleWebCuratorMessage: async (msg: {
    lotCode: string;
    dealId?: string;
    threadChannel: 'seller_curator' | 'buyer_curator';
    senderUser: { id: string; role: string; name: string };
    text: string;
    skipDbWrite?: boolean;
  }) => {
    try {
      if (!telegramClient.isConfigured()) return;
      await relayBridgedMessage({
        ...msg,
        source: 'web',
      });
    } catch (err: any) {
      logger.warn('Error in handleWebCuratorMessage', { meta: { error: err.message } });
    }
  },
};
