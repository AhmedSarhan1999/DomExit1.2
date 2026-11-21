import crypto from 'node:crypto';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, normalizeHeaders } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { telegramClient, escapeHtml } from '../lib/telegramClient.js';
import {
  findTelegramBindingByUser,
  findTelegramBindingByChat,
  assignCuratorToLot,
  transitionLotStage,
  relayBridgedMessage,
  STAGE_LABELS,
  STAGE_TRANSITIONS,
} from '../lib/telegramWorkflow.js';
import { logger } from '../lib/logger.js';
import { consumeQuota } from '../lib/anomalyDetector.js';

// In-memory replay de-duplication buffer (up to 500 recent update IDs)
const seenUpdates = new Set<number>();
const updateIdsQueue: number[] = [];

function isDuplicateUpdate(updateId: number): boolean {
  if (!updateId) return false;
  if (seenUpdates.has(updateId)) return true;
  seenUpdates.add(updateId);
  updateIdsQueue.push(updateId);
  if (updateIdsQueue.length > 500) {
    const oldest = updateIdsQueue.shift();
    if (oldest !== undefined) seenUpdates.delete(oldest);
  }
  return false;
}

export async function handleTelegram(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const cfg = getConfig();
  const ydb = getYdbClient();

  // Normalize subPath: e.g. /api/telegram/webhook or /telegram/status
  const action = subPath.replace(/^\/(?:api\/)?telegram\/?/, '').split('?')[0].toLowerCase();

  // -------------------------------------------------------------
  // 1. PUBLIC WEBHOOK (Telegram -> Cloud Function)
  // -------------------------------------------------------------
  if (action === 'webhook') {
    if (method !== 'POST') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    // Verify secret token from Telegram header case-insensitively
    const normHeaders = normalizeHeaders(event.headers, event.multiValueHeaders);
    const incomingSecret = (normHeaders['x-telegram-bot-api-secret-token'] || '').trim();
    const expectedSecret = cfg.TELEGRAM_WEBHOOK_SECRET?.trim() || '';

    if (
      !expectedSecret ||
      Buffer.byteLength(incomingSecret) !== Buffer.byteLength(expectedSecret)
    ) {
      logger.warn('Telegram webhook rejected: secret mismatch or empty', {
        event: 'TELEGRAM_WEBHOOK_UNAUTHORIZED',
      });
      return json(event, 403, { error: 'Forbidden: invalid webhook secret' });
    }

    const isAuthorized = crypto.timingSafeEqual(
      Buffer.from(incomingSecret),
      Buffer.from(expectedSecret)
    );
    if (!isAuthorized) {
      logger.warn('Telegram webhook rejected: secret mismatch', {
        event: 'TELEGRAM_WEBHOOK_UNAUTHORIZED',
      });
      return json(event, 403, { error: 'Forbidden: invalid webhook secret' });
    }

    const body = parseBody(event);
    if (!body || typeof body !== 'object') {
      return json(event, 200, { ok: true, skipped: 'empty_body' });
    }

    // De-duplicate update_id
    if (body.update_id && isDuplicateUpdate(body.update_id)) {
      return json(event, 200, { ok: true, skipped: 'duplicate_update' });
    }

    try {
      await processTelegramUpdate(body);
    } catch (err: any) {
      logger.error('Error processing telegram update', {
        event: 'TELEGRAM_PROCESS_ERROR',
        meta: { error: err.message },
      });
    }

    return json(event, 200, { ok: true });
  }

  // -------------------------------------------------------------
  // 2. REST API (Authenticated Web Client -> Server)
  // -------------------------------------------------------------
  const authUser = await getAuthenticatedUser(event);

  // GET /api/telegram/status
  if (action === 'status' && method === 'GET') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const binding = await findTelegramBindingByUser(authUser.id);

    return json(event, 200, {
      configured: telegramClient.isConfigured(),
      botUsername: cfg.TELEGRAM_BOT_USERNAME || '',
      linked: Boolean(binding && binding.chatId),
      telegramUsername: binding?.telegramUsername || undefined,
      notificationsEnabled: binding?.notificationsEnabled !== false,
      boundAt: binding?.boundAt || undefined,
    });
  }

  // POST /api/telegram/link-token
  if (action === 'link-token' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const tokenQuota = await consumeQuota({
      scope: 'telegram_link_token',
      actorKey: authUser.id,
      limit: 5,
      windowSec: 3600,
    });
    if (!tokenQuota.allowed) {
      return json(
        event,
        429,
        {
          error: 'Превышен лимит генерации токенов Telegram (максимум 5 в час).',
          retryAfter: tokenQuota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(tokenQuota.retryAfterSec) } }
      );
    }

    // Generate 32-character hex token (16 bytes) so bind_<token> is 37 chars <= 64 chars
    const token = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await ydb.putItem('telegram_link_tokens', {
      id: token,
      token,
      userId: authUser.id,
      userEmail: authUser.email,
      role: authUser.role,
      used: false,
      createdAt: now.toISOString(),
      expiresAt,
    });

    const botUser = cfg.TELEGRAM_BOT_USERNAME || 'DomExitOfficialBot';
    const deepLink = `https://t.me/${botUser}?start=bind_${token}`;

    return json(event, 200, {
      success: true,
      token,
      deepLink,
      expiresInSec: 600,
      configured: telegramClient.isConfigured(),
      botUsername: botUser,
    });
  }

  // POST /api/telegram/unlink
  if (action === 'unlink' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const binding = await findTelegramBindingByUser(authUser.id);
    if (binding) {
      if (binding.chatId) {
        await ydb.deleteItem('telegram_bindings', `chat:${binding.chatId}`);
      }
      await ydb.deleteItem('telegram_bindings', `user:${authUser.id}`);
    }

    return json(event, 200, { success: true });
  }

  // PATCH /api/telegram/preferences
  if (action === 'preferences' && (method === 'PATCH' || method === 'POST')) {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = parseBody(event) || {};
    const enabled = body.notificationsEnabled !== false;

    const binding = await findTelegramBindingByUser(authUser.id);
    if (binding) {
      const updated = {
        ...binding,
        notificationsEnabled: enabled,
        updatedAt: new Date().toISOString(),
      };
      await ydb.putItem('telegram_bindings', { ...updated, id: `user:${authUser.id}` });
      if (binding.chatId) {
        await ydb.putItem('telegram_bindings', { ...updated, id: `chat:${binding.chatId}` });
      }
    }

    return json(event, 200, { success: true, notificationsEnabled: enabled });
  }

  // POST /api/telegram/assign (Staff / Owner only)
  if (action === 'assign' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    if (authUser.role !== 'owner' && authUser.role !== 'employee') {
      return json(event, 403, { error: 'Назначение доступно только сотрудникам и владельцу' });
    }

    const body = parseBody(event) || {};
    const { lotCode, employeeId } = body;

    if (!lotCode || !employeeId) {
      return json(event, 400, { error: 'Не указан lotCode или employeeId' });
    }

    try {
      const result = await assignCuratorToLot({
        lotCode,
        employeeId,
        actor: {
          id: authUser.id,
          role: authUser.role,
          name: authUser.name,
          email: authUser.email,
        },
      });
      return json(event, 200, { success: true, ...result });
    } catch (err: any) {
      return json(event, 400, { error: err.message });
    }
  }

  // POST /api/telegram/stage (Owner or assigned curator)
  if (action === 'stage' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = parseBody(event) || {};
    const { lotCode, nextStage, reason } = body;

    if (!lotCode || !nextStage) {
      return json(event, 400, { error: 'Не указан lotCode или nextStage' });
    }

    try {
      const result = await transitionLotStage({
        lotCode,
        nextStage,
        reason,
        actor: {
          id: authUser.id,
          role: authUser.role,
          name: authUser.name,
          email: authUser.email,
          assignedEmployeeId: authUser.assignedEmployeeId,
        },
      });
      return json(event, 200, { success: true, ...result });
    } catch (err: any) {
      return json(event, 400, { error: err.message });
    }
  }

  // POST /api/telegram/test (Owner only - live verification test)
  if (action === 'test' && method === 'POST') {
    if (!authUser || authUser.role !== 'owner') {
      return json(event, 403, { error: 'Тестовая отправка разрешена только владельцу' });
    }

    const binding = await findTelegramBindingByUser(authUser.id);
    if (!binding || !binding.chatId) {
      return json(event, 400, {
        error: 'Telegram аккаунт владельца еще не привязан. Нажмите "Подключить Telegram" в панели.',
      });
    }

    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const sendRes = await telegramClient.sendMessage({
      chat_id: binding.chatId,
      text: [
        `⚡ <b>Тестовое уведомление DomExit OS</b>`,
        `Связь установлена успешно!`,
        `Время проверки: <code>${now} (MSK)</code>`,
        `Владелец: <b>${escapeHtml(authUser.email)}</b>`,
      ].join('\n'),
    });

    return json(event, 200, {
      success: sendRes.ok,
      sent: sendRes.ok,
      description: sendRes.description,
    });
  }

  return json(event, 404, { error: `Endpoint /api/telegram/${action} не найден` });
}

// -------------------------------------------------------------
// INTERNAL TELEGRAM BOT ENGINE (ALWAYS-RESPOND POLICY)
// -------------------------------------------------------------

async function showMainMenu(chatId: string | number, binding: any, cfg: any): Promise<void> {
  if (!binding) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `🔒 <b>Требуется привязка аккаунта</b>`,
        ``,
        `Для доступа к меню и управлению сделками привяжите ваш аккаунт DomExit:`,
        `1. Перейдите на сайт ${cfg.PUBLIC_BASE_URL}`,
        `2. В личном кабинете нажмите кнопку <b>«Подключить Telegram»</b>.`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Перейти на сайт DomExit', url: cfg.PUBLIC_BASE_URL }]],
      },
    });
    return;
  }

  const role = binding.role;
  const menuText = `📋 <b>Главное меню [${role === 'owner' ? 'Владелец' : role === 'employee' ? 'Куратор' : 'Клиент'}]</b>`;
  const buttons: any[] = [];

  if (role === 'owner') {
    buttons.push([
      { text: '📊 Сводка /stats', callback_data: 'cmd_stats' },
      { text: '📋 Задачи /tasks', callback_data: 'cmd_tasks' },
    ]);
    buttons.push([
      { text: '👥 Команда /team', callback_data: 'cmd_team' },
      { text: '🌐 Открыть сайт', url: cfg.PUBLIC_BASE_URL },
    ]);
  } else if (role === 'employee') {
    buttons.push([
      { text: '📋 Мои задачи', callback_data: 'cmd_mytasks' },
      { text: '🌐 Админка', url: `${cfg.PUBLIC_BASE_URL}/admin/dashboard` },
    ]);
  } else {
    buttons.push([
      { text: '📑 Мои объекты', callback_data: 'cmd_mydeals' },
      { text: '🌐 Личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` },
    ]);
  }

  await telegramClient.sendMessage({
    chat_id: chatId,
    text: menuText,
    reply_markup: { inline_keyboard: buttons },
  });
}

async function showStats(chatId: string | number, binding: any, ydb: any, cfg: any): Promise<void> {
  if (!binding) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: `🔒 Для просмотра сводки привяжите аккаунт на сайте:\n${cfg.PUBLIC_BASE_URL}`,
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Открыть сайт', url: cfg.PUBLIC_BASE_URL }]],
      },
    });
    return;
  }

  if (binding.role !== 'owner' && binding.role !== 'employee') {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: '⛔ Оперативная сводка доступна только для руководства и сотрудников платформы.',
    });
    return;
  }

  const lots = await ydb.scanAll('lots', 500);
  const deals = await ydb.scanAll('deals', 500);

  const activeCount = lots.filter((l: any) => l.status === 'active').length;
  const reservedCount = lots.filter((l: any) => l.status === 'reserved').length;
  const moderationCount = lots.filter((l: any) => l.status === 'intake_moderation' || !l.status).length;
  const soldCount = lots.filter((l: any) => l.status === 'sold').length;

  const statsMsg = [
    `📊 <b>Оперативная сводка платформы DomExit</b>`,
    ``,
    `Всего объектов: <b>${lots.length}</b>`,
    `• На модерации / приеме: <b>${moderationCount}</b>`,
    `• Активны в каталоге: <b>${activeCount}</b>`,
    `• В процессе сделки / бронь: <b>${reservedCount}</b>`,
    `• Успешно закрыто: <b>${soldCount}</b>`,
    ``,
    `Активных сделок в работе: <b>${deals.length}</b>`,
  ].join('\n');

  await telegramClient.sendMessage({
    chat_id: chatId,
    text: statsMsg,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Задачи /tasks', callback_data: 'cmd_tasks' },
          { text: '🌐 Админка', url: `${cfg.PUBLIC_BASE_URL}/admin/dashboard` },
        ],
      ],
    },
  });
}

async function showTasks(chatId: string | number, binding: any, ydb: any, cmd: string, cfg: any): Promise<void> {
  if (!binding) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: `🔒 Для просмотра задач привяжите аккаунт на сайте:\n${cfg.PUBLIC_BASE_URL}`,
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Открыть сайт', url: cfg.PUBLIC_BASE_URL }]],
      },
    });
    return;
  }

  if (binding.role !== 'owner' && binding.role !== 'employee') {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: '⛔ Задачи доступны только для сотрудников и кураторов платформы.',
    });
    return;
  }

  const lots = await ydb.scanAll('lots', 500);
  const isOwner = binding.role === 'owner';
  const empId = binding.assignedEmployeeId || binding.userId;

  const pendingLots = lots
    .filter((l: any) => {
      if (l.status === 'sold' || l.status === 'rejected' || l.status === 'cancelled') return false;
      if (isOwner && cmd === '/tasks') return true;
      return l.assignedEmployeeId === empId || (!l.assignedEmployeeId && isOwner);
    })
    .slice(0, 5);

  if (pendingLots.length === 0) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: '🎉 Отличная работа! Все актуальные задачи и лоты распределены.',
    });
    return;
  }

  for (const lot of pendingLots) {
    const code = lot.lotCode || lot.id;
    const card = [
      `📌 <b>Лот #${escapeHtml(code)} [${escapeHtml(STAGE_LABELS[lot.status] || lot.status || 'intake')}]</b>`,
      `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b>`,
      `Куратор: <b>${escapeHtml(lot.assignedEmployeeName || 'Не назначен')}</b>`,
    ].join('\n');

    await telegramClient.sendMessage({
      chat_id: chatId,
      text: card,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏭ Сменить этап', callback_data: `stage_menu:${code}` },
            { text: '💬 Ответить', callback_data: `reply:${code}:seller_curator` },
          ],
        ],
      },
    });
  }
}

async function showTeam(chatId: string | number, binding: any, ydb: any, cfg: any): Promise<void> {
  if (!binding) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: `🔒 Для просмотра состава команды привяжите аккаунт на сайте:\n${cfg.PUBLIC_BASE_URL}`,
    });
    return;
  }

  if (binding.role !== 'owner') {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: '⛔ Просмотр команды доступен только владельцу платформы.',
    });
    return;
  }

  const employees = await ydb.scanAll('employees', 100);
  const teamMsg = [
    `👥 <b>Команда кураторов DomExit:</b>`,
    ``,
    ...employees.map((emp: any) => {
      return `• <b>${escapeHtml(emp.name)}</b> (${escapeHtml(emp.role || 'Куратор')})\n  Тел: ${escapeHtml(emp.phone || '—')} | Нагрузка: ${emp.activeDealsCount || 0} сделок`;
    }),
  ].join('\n');

  await telegramClient.sendMessage({ chat_id: chatId, text: teamMsg });
}

async function showMyDeals(chatId: string | number, binding: any, ydb: any, cfg: any): Promise<void> {
  if (!binding) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `🔒 <b>Требуется привязка аккаунта</b>`,
        ``,
        `Для просмотра ваших сделок привяжите Telegram на сайте:`,
        `1. Перейдите в личный кабинет: ${cfg.PUBLIC_BASE_URL}/client/portal`,
        `2. Нажмите кнопку <b>«Подключить Telegram»</b>.`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Открыть личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }]],
      },
    });
    return;
  }

  const deals = await ydb.scanAll('deals', 200);
  const myDeals = deals.filter(
    (d: any) => d.buyerId === binding.userId || d.sellerId === binding.userId || d.userId === binding.userId
  );

  if (myDeals.length === 0) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: 'У вас пока нет активных сделок на платформе DomExit.',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Каталог объектов', url: `${cfg.PUBLIC_BASE_URL}/opportunities` }],
          [{ text: '🌐 Личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
        ],
      },
    });
    return;
  }

  const list = myDeals
    .slice(0, 5)
    .map(
      (d: any) =>
        `• <b>Сделка #${escapeHtml(d.id || d.dealId)}</b>\n  Этап: ${escapeHtml(STAGE_LABELS[d.status] || d.status || 'В работе')}`
    )
    .join('\n\n');

  await telegramClient.sendMessage({
    chat_id: chatId,
    text: `📑 <b>Ваши сделки на платформе DomExit:</b>\n\n${list}`,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Открыть кабинет сделки', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
      ],
    },
  });
}

async function processTelegramUpdate(update: any): Promise<void> {
  const ydb = getYdbClient();
  const cfg = getConfig();
  let currentChatId: number | string | undefined =
    update.message?.chat?.id || update.callback_query?.message?.chat?.id || update.callback_query?.from?.id;

  try {
    // 1. Process Callback Query (Button Clicks)
    if (update.callback_query) {
      const cq = update.callback_query;
      const cqId = cq.id;
      const data = cq.data || '';
      const chatId = cq.message?.chat?.id || cq.from?.id;
      currentChatId = chatId;

      // Answer callback query promptly to remove loading spinner
      await telegramClient.answerCallbackQuery({ callback_query_id: cqId });

      const binding = await findTelegramBindingByChat(chatId);
      const userRole = binding?.role || 'guest';

      // Callback command shortcuts
      if (data === 'menu') {
        await showMainMenu(chatId, binding, cfg);
        return;
      }
      if (data === 'cmd_stats') {
        await showStats(chatId, binding, ydb, cfg);
        return;
      }
      if (data === 'cmd_tasks' || data === 'cmd_mytasks') {
        await showTasks(chatId, binding, ydb, data === 'cmd_tasks' ? '/tasks' : '/mytasks', cfg);
        return;
      }
      if (data === 'cmd_team') {
        await showTeam(chatId, binding, ydb, cfg);
        return;
      }
      if (data === 'cmd_mydeals') {
        await showMyDeals(chatId, binding, ydb, cfg);
        return;
      }

      if (data.startsWith('accept:')) {
        const lotCode = data.replace(/^accept:/, '');
        if (userRole !== 'owner' && userRole !== 'employee') {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: '⛔ Только сотрудники платформы могут принимать лоты в работу.',
          });
          return;
        }

        try {
          const empId = binding?.assignedEmployeeId || binding?.userId;
          const res = await assignCuratorToLot({
            lotCode,
            employeeId: empId,
            actor: {
              id: binding.userId,
              role: binding.role,
              name: `${cq.from.first_name || ''} ${cq.from.last_name || ''}`.trim() || 'Куратор',
              email: binding.userEmail,
            },
          });

          if (cq.message?.message_id) {
            await telegramClient.editMessageText({
              chat_id: chatId,
              message_id: cq.message.message_id,
              text: `✅ <b>Лот #${escapeHtml(lotCode)} успешно принят в работу!</b>\nКуратор: ${escapeHtml(res.employee.name)}`,
            });
          }
        } catch (err: any) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `⚠️ Ошибка: ${escapeHtml(err.message)}`,
          });
        }
        return;
      }

      if (data.startsWith('stage_menu:')) {
        const lotCode = data.replace(/^stage_menu:/, '');
        let lot = await ydb.getItem('lots', lotCode);
        if (!lot) {
          const all = await ydb.scanAll('lots', 200);
          lot = all.find((l: any) => l.lotCode === lotCode || l.id === lotCode);
        }

        if (!lot) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `Лот #${escapeHtml(lotCode)} не найден`,
          });
          return;
        }

        const currentStage = lot.status || 'intake_moderation';
        const allowedNext = STAGE_TRANSITIONS[currentStage] || [];

        if (allowedNext.length === 0) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `Лот находится на финальном этапе: <b>${escapeHtml(STAGE_LABELS[currentStage] || currentStage)}</b>`,
          });
          return;
        }

        const buttons = allowedNext.map((st) => [
          {
            text: `➡️ ${STAGE_LABELS[st] || st}`,
            callback_data: `stage_set:${lotCode}:${st}`,
          },
        ]);
        buttons.push([{ text: '❌ Отмена', callback_data: 'cancel' }]);

        await telegramClient.sendMessage({
          chat_id: chatId,
          text: `Выберите новый этап для лота #${escapeHtml(lotCode)}:\nТекущий: <b>${escapeHtml(STAGE_LABELS[currentStage] || currentStage)}</b>`,
          reply_markup: { inline_keyboard: buttons },
        });
        return;
      }

      if (data.startsWith('stage_set:')) {
        const parts = data.replace(/^stage_set:/, '').split(':');
        const lotCode = parts[0];
        const targetStage = parts[1];

        if (!binding) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: 'Для смены этапа авторизуйтесь через портал DomExit.',
          });
          return;
        }

        try {
          await transitionLotStage({
            lotCode,
            nextStage: targetStage,
            actor: {
              id: binding.userId,
              role: binding.role,
              name: `${cq.from.first_name || ''} ${cq.from.last_name || ''}`.trim() || 'Куратор',
              email: binding.userEmail,
            },
          });

          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `✅ Этап лота #${escapeHtml(lotCode)} успешно изменен на <b>${escapeHtml(STAGE_LABELS[targetStage] || targetStage)}</b>`,
          });
        } catch (err: any) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: `⚠️ Не удалось изменить этап: ${escapeHtml(err.message)}`,
          });
        }
        return;
      }

      if (data.startsWith('reply:')) {
        const parts = data.replace(/^reply:/, '').split(':');
        const lotCode = parts[0];
        const threadChannel = (parts[1] as any) || 'seller_curator';

        if (!binding) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: 'Для отправки сообщений привяжите Telegram к вашему аккаунту DomExit.',
          });
          return;
        }

        // Store active reply context on chat binding
        const updatedBinding = {
          ...binding,
          activeReplyContext: {
            lotCode,
            threadChannel,
            expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
          },
        };
        await ydb.putItem('telegram_bindings', updatedBinding);

        await telegramClient.sendMessage({
          chat_id: chatId,
          text: `✍️ <b>Напишите ответ для лота #${escapeHtml(lotCode)}</b>\nСообщение будет отправлено прямо в чат портала. (Для отмены введите /cancel)`,
        });
        return;
      }

      if (data === 'cancel') {
        if (binding?.activeReplyContext) {
          const updatedBinding = { ...binding };
          delete updatedBinding.activeReplyContext;
          await ydb.putItem('telegram_bindings', updatedBinding);
        }
        await telegramClient.sendMessage({
          chat_id: chatId,
          text: 'Действие отменено.',
        });
        return;
      }

      return;
    }

    // 2. Process Messages
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat?.id;
    if (!chatId) return;
    currentChatId = chatId;

    const text = (msg.text || '').trim();
    const binding = await findTelegramBindingByChat(chatId);

    // Command: /start or /start bind_<token>
    if (text.startsWith('/start')) {
      const bindMatch = text.match(/\/start\s+bind_([a-f0-9]{32,64})/i);

      if (bindMatch) {
        const token = bindMatch[1];
        const linkToken = await ydb.getItem('telegram_link_tokens', token);

        if (!linkToken) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: '❌ Ссылка для привязки недействительна или срок ее действия истек.\n\nЗапросите новую ссылку в личном кабинете на сайте:',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 Открыть личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
              ],
            },
          });
          return;
        }

        if (linkToken.used) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: '⚠️ Этот токен уже был использован ранее.\n\nСгенерируйте новую ссылку в личном кабинете:',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 Открыть личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
              ],
            },
          });
          return;
        }

        if (new Date(linkToken.expiresAt).getTime() < Date.now()) {
          await telegramClient.sendMessage({
            chat_id: chatId,
            text: '⏰ Срок действия ссылки истек (10 минут).\n\nЗапросите новую ссылку в личном кабинете:',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🌐 Открыть личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
              ],
            },
          });
          return;
        }

        // Mark token used
        await ydb.putItem('telegram_link_tokens', {
          ...linkToken,
          used: true,
          usedAt: new Date().toISOString(),
          chatId: String(chatId),
          telegramUsername: msg.from?.username || '',
        });

        // Get user details
        const user = await ydb.getItem('users', linkToken.userId);

        // Save dual bindings in telegram_bindings
        const bindingData = {
          chatId: String(chatId),
          userId: linkToken.userId,
          userEmail: user?.email || linkToken.userEmail || '',
          role: user?.role || linkToken.role || 'client',
          assignedEmployeeId: user?.assignedEmployeeId || undefined,
          telegramUsername: msg.from?.username || '',
          firstName: msg.from?.first_name || '',
          lastName: msg.from?.last_name || '',
          notificationsEnabled: true,
          boundAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await ydb.putItem('telegram_bindings', { ...bindingData, id: `chat:${chatId}` });
        await ydb.putItem('telegram_bindings', { ...bindingData, id: `user:${linkToken.userId}` });

        // Send Role-Tailored Russian Welcome
        let welcomeMsg = '';
        if (bindingData.role === 'owner') {
          welcomeMsg = [
            `👑 <b>Добро пожаловать в DomExit OS (Владелец)!</b>`,
            `Ваш профиль <b>${escapeHtml(bindingData.userEmail)}</b> успешно связан с Telegram.`,
            ``,
            `Вам доступны команды:`,
            `• /stats — Оперативная сводка по лотам и сделкам`,
            `• /tasks — Все открытые задачи и лоты без куратора`,
            `• /team — Статус кураторов и команды`,
            `• /menu — Главное командное меню`,
          ].join('\n');
        } else if (bindingData.role === 'employee') {
          welcomeMsg = [
            `💼 <b>Добро пожаловать в рабочее место куратора DomExit!</b>`,
            `Ваш рабочий аккаунт <b>${escapeHtml(bindingData.userEmail)}</b> успешно привязан.`,
            ``,
            `Сюда будут поступать новые лоты, запросы покупателей и сообщения клиентов.`,
            `Доступные команды:`,
            `• /mytasks — Ваши активные лоты в работе`,
            `• /chats — Сообщения по курируемым объектам`,
            `• /menu — Рабочее меню`,
          ].join('\n');
        } else {
          welcomeMsg = [
            `🤝 <b>Добро пожаловать в сервис уведомлений DomExit!</b>`,
            `Ваш аккаунт <b>${escapeHtml(bindingData.userEmail)}</b> успешно подключен.`,
            ``,
            `Здесь вы будете моментально узнавать о прогрессе вашей сделки, получать юридические отчеты и вести прямой защищенный диалог с персональным куратором.`,
            `Команда: /menu — Посмотреть статус`,
          ].join('\n');
        }

        await telegramClient.sendMessage({
          chat_id: chatId,
          text: welcomeMsg,
          reply_markup: {
            inline_keyboard: [[{ text: '📋 Главное меню', callback_data: 'menu' }]],
          },
        });
        return;
      }

      // Default /start without token
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: [
          `👋 Здравствуйте! Это официальный бот платформы <b>DomExit</b>.`,
          ``,
          `Для подключения уведомлений и управления сделками:`,
          `1. Авторизуйтесь на сайте DomExit: ${cfg.PUBLIC_BASE_URL}`,
          `2. Перейдите в личный кабинет.`,
          `3. Нажмите кнопку <b>«Подключить Telegram»</b>.`,
        ].join('\n'),
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Открыть сайт DomExit', url: cfg.PUBLIC_BASE_URL }]],
        },
      });
      return;
    }

    // Cancel pending action
    if (text === '/cancel') {
      if (binding?.activeReplyContext) {
        const updatedBinding = { ...binding };
        delete updatedBinding.activeReplyContext;
        await ydb.putItem('telegram_bindings', updatedBinding);
      }
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: 'Действие отменено.',
      });
      return;
    }

    // Command: /menu
    if (text === '/menu') {
      await showMainMenu(chatId, binding, cfg);
      return;
    }

    // Command: /stats
    if (text === '/stats') {
      await showStats(chatId, binding, ydb, cfg);
      return;
    }

    // Command: /tasks or /mytasks
    if (text === '/tasks' || text === '/mytasks') {
      await showTasks(chatId, binding, ydb, text, cfg);
      return;
    }

    // Command: /team
    if (text === '/team') {
      await showTeam(chatId, binding, ydb, cfg);
      return;
    }

    // Command: /mydeals
    if (text === '/mydeals') {
      await showMyDeals(chatId, binding, ydb, cfg);
      return;
    }

    // Command: /unlink
    if (text === '/unlink') {
      if (binding) {
        await ydb.deleteItem('telegram_bindings', `chat:${chatId}`);
        await ydb.deleteItem('telegram_bindings', `user:${binding.userId}`);
      }
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: 'Ваш Telegram-аккаунт успешно отвязан от платформы DomExit.',
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Войти на сайт', url: cfg.PUBLIC_BASE_URL }]],
        },
      });
      return;
    }

    // 3. Native Telegram Reply Bridge: User swiped and replied to a bot message
    if (msg.reply_to_message?.message_id) {
      const parentMsgId = msg.reply_to_message.message_id;
      const mapRecord = await ydb.getItem('telegram_message_map', `msg:${chatId}:${parentMsgId}`);

      if (mapRecord && binding) {
        await relayBridgedMessage({
          lotCode: mapRecord.lotCode,
          dealId: mapRecord.dealId,
          threadChannel: mapRecord.threadChannel,
          senderUser: {
            id: binding.userId,
            role: binding.role,
            name: `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim() || 'Пользователь',
          },
          text,
          source: 'telegram',
        });

        await telegramClient.sendMessage({
          chat_id: chatId,
          text: `✅ Сообщение по лоту #${escapeHtml(mapRecord.lotCode)} доставлено в чат на сайте!`,
        });
        return;
      }
    }

    // 4. Active Reply Context (if user pressed "💬 Ответить" earlier)
    if (binding?.activeReplyContext) {
      const ctx = binding.activeReplyContext;
      if (ctx.expiresAt && ctx.expiresAt > Date.now()) {
        await relayBridgedMessage({
          lotCode: ctx.lotCode,
          threadChannel: ctx.threadChannel || 'seller_curator',
          senderUser: {
            id: binding.userId,
            role: binding.role,
            name: `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim() || 'Пользователь',
          },
          text,
          source: 'telegram',
        });

        // Clear context
        const updatedBinding = { ...binding };
        delete updatedBinding.activeReplyContext;
        await ydb.putItem('telegram_bindings', updatedBinding);

        await telegramClient.sendMessage({
          chat_id: chatId,
          text: `✅ Сообщение по лоту #${escapeHtml(ctx.lotCode)} успешно отправлено в чат портала!`,
        });
        return;
      }
    }

    // 5. Default fallback (Always respond politely with menu button)
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: 'Команда не распознана. Введите /menu для вызова главного меню или /cancel для отмены.',
      reply_markup: {
        inline_keyboard: [[{ text: '📋 Главное меню', callback_data: 'menu' }]],
      },
    });
  } catch (err: any) {
    logger.error('Unhandled error in processTelegramUpdate', {
      event: 'TELEGRAM_HANDLER_ERROR',
      meta: { error: err.message, stack: err.stack },
    });
    if (currentChatId) {
      try {
        await telegramClient.sendMessage({
          chat_id: currentChatId,
          text: '⚠️ Произошла временная ошибка сервиса. Мы уже работаем над ее устранением. Попробуйте еще раз через минуту.',
        });
      } catch {}
    }
  }
}
