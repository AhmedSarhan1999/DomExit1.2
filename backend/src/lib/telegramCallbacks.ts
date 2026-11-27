import crypto from 'node:crypto';
import { telegramClient, escapeHtml } from './telegramClient.js';
import {
  assignCuratorToLot,
  transitionLotStage,
  findTelegramBindingByUser,
  STAGE_LABELS,
  STAGE_TRANSITIONS,
} from './telegramWorkflow.js';
import {
  showMainMenu,
  showStats,
  showTasks,
  showTeam,
  showMyDeals,
  showMatches,
  showQueue,
  showDemand,
} from './telegramCommands.js';
import { getYdbClient } from './ydbClient.js';
import { recordJournalEvent } from './journal.js';
import { consumeQuota } from './anomalyDetector.js';
import { computeMatchScore, computeClosingScore, rankApplications } from './buyBoxEngine.js';
import { logger } from './logger.js';
import { BuyerApplication, BuyerBuyBox, PriceAcceptance } from '../types.js';
import {
  applyConciergeBuyBoxDraft,
  requestConciergeHumanHandoff,
} from '../modules/proptech-ai/ragConciergeService.js';

async function findLot(ydb: any, lotCode: string): Promise<any | null> {
  const clean = String(lotCode || '').trim();
  if (!clean) return null;
  let lot = await ydb.getItem('lots', clean).catch(() => null);
  if (lot) return lot;
  if (ydb.isV2TablesEnabled?.()) {
    const [exactMatches, upperMatches] = await Promise.all([
      ydb.queryAllByIndex({
        tableName: 'lots',
        indexName: 'lotCode-index',
        hashKey: 'lotCode',
        hashValue: clean,
        limit: 5,
      }).catch(() => []),
      clean.toUpperCase() !== clean
        ? ydb.queryAllByIndex({
            tableName: 'lots',
            indexName: 'lotCode-index',
            hashKey: 'lotCode',
            hashValue: clean.toUpperCase(),
            limit: 5,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);
    const found = exactMatches[0] || upperMatches[0];
    if (found) return found;
  }
  const all = (await ydb.scanAll('lots', 500).catch(() => [])) || [];
  return (
    all.find(
      (l: any) =>
        String(l.lotCode || '').trim().toUpperCase() === clean.toUpperCase() ||
        String(l.id || '').trim().toUpperCase() === clean.toUpperCase()
    ) || null
  );
}

async function findLotApplications(ydb: any, lotCode: string): Promise<any[]> {
  const cleanUpper = String(lotCode || '').trim().toUpperCase();
  if (ydb.isV2TablesEnabled?.()) {
    const apps = await ydb.queryAllByIndex({
      tableName: 'buyer_applications',
      indexName: 'lotId-createdAt-index',
      hashKey: 'lotId',
      hashValue: cleanUpper,
    }).catch(() => []);
    if (apps && apps.length > 0) return apps;
  }
  const allApps = (await ydb.scanAll('buyer_applications', 300).catch(() => [])) || [];
  return allApps.filter((a: any) => String(a.lotCode || '').trim().toUpperCase() === cleanUpper);
}

async function notifyStaffTg(text: string): Promise<void> {
  try {
    const ydb = getYdbClient();
    const users = ydb.isV2TablesEnabled?.()
      ? (
          await Promise.all([
            ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' }),
            ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'employee' }),
          ])
        ).flat()
      : await ydb.scanAll<any>('users', 200);
    const staff = (users || []).filter((u: any) => u.role === 'owner' || u.role === 'employee');
    for (const s of staff) {
      const b = await findTelegramBindingByUser(s.id);
      if (b && b.chatId && b.notificationsEnabled !== false) {
        await telegramClient.sendMessage({ chat_id: b.chatId, text, parse_mode: 'HTML' }).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.warn('Failed to send staff tg in callbacks', { meta: { error: err.message } });
  }
}

async function notifyUserTg(userId: string, text: string): Promise<void> {
  try {
    const b = await findTelegramBindingByUser(userId);
    if (b && b.chatId && b.notificationsEnabled !== false) {
      await telegramClient.sendMessage({ chat_id: b.chatId, text, parse_mode: 'HTML' }).catch(() => {});
    }
  } catch (err: any) {
    logger.warn('Failed to send user tg in callbacks', { meta: { error: err.message, userId } });
  }
}

export async function handleTelegramCallback(
  cq: any,
  binding: any,
  ydb: any,
  cfg: any
): Promise<void> {
  const cqId = cq.id;
  const data = cq.data || '';
  const chatId = cq.message?.chat?.id || cq.from?.id;
  if (!chatId) return;

  // Answer callback query promptly to remove loading spinner
  await telegramClient.answerCallbackQuery({ callback_query_id: cqId });

  const userRole = binding?.role || 'guest';

  // Unlink callback
  if (data === 'unlink' || data === 'settings:unlink') {
    if (binding) {
      await ydb.deleteItem('telegram_bindings', `chat:${chatId}`);
      await ydb.deleteItem('telegram_bindings', `user:${binding.userId}`);
    } else {
      const existingChat = await ydb.getItem('telegram_bindings', `chat:${chatId}`);
      if (existingChat) {
        await ydb.deleteItem('telegram_bindings', `chat:${chatId}`);
        if (existingChat.userId) {
          await ydb.deleteItem('telegram_bindings', `user:${existingChat.userId}`);
        }
      }
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
  if (data === 'cmd_matches') {
    await showMatches(chatId, binding, ydb, cfg);
    return;
  }
  if (data === 'cmd_demand') {
    await showDemand(chatId, binding, ydb, cfg);
    return;
  }

  // AI Concierge Callbacks
  if (data === 'cmd_ai_concierge') {
    if (binding) {
      binding.aiConciergeActive = true;
      binding.updatedAt = new Date().toISOString();
      await ydb.putItem('telegram_bindings', binding);
    }
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `🤖 <b>AI-Консьерж DomExit</b>`,
        ``,
        `Я официальный ассистент по переуступкам ДДУ (214-ФЗ). Отвечу на ваши вопросы по:`,
        `• Безопасным расчетам через СБР и аккредитив`,
        `• Комиссиям (0% для продавца, 2.5% для покупателя)`,
        `• Проверке рисков банкротства по 61.2 ФЗ-127`,
        `• Подбору квартир в строящихся домах под ваш Buy-Box`,
        ``,
        `Напишите ваш вопрос прямо сюда или нажмите «✕ Выйти из AI-консьержа» для возврата к меню.`,
      ].join('\n'),
      reply_markup: {
        keyboard: [
          [{ text: '✕ Выйти из AI-консьержа' }],
          [{ text: 'Как работает переуступка ДДУ?' }, { text: 'Подобрать квартиру в Buy-Box' }],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  if (data.startsWith('concierge_save_bb:')) {
    const sessionId = data.replace('concierge_save_bb:', '').trim();
    if (!binding?.userId) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: '⚠️ Для сохранения Buy-Box привяжите ваш аккаунт на сайте.',
      });
      return;
    }
    try {
      await applyConciergeBuyBoxDraft(sessionId, { id: binding.userId, role: binding.role });
      if (cq.message?.message_id) {
        await telegramClient.editMessageText({
          chat_id: chatId,
          message_id: cq.message.message_id,
          text: (cq.message.text || '') + '\n\n✅ <b>Параметры успешно сохранены в ваш Buy-Box!</b>',
          parse_mode: 'HTML',
        });
      }
    } catch (err: any) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `⚠️ Ошибка сохранения: ${escapeHtml(err.message)}`,
      });
    }
    return;
  }

  if (data.startsWith('concierge_handoff:')) {
    const sessionId = data.replace('concierge_handoff:', '').trim();
    try {
      await requestConciergeHumanHandoff(sessionId, {
        id: binding?.userId,
        name: `${cq.from?.first_name || ''} ${cq.from?.last_name || ''}`.trim() || 'Клиент Telegram',
        role: binding?.role,
      });
      if (cq.message?.message_id) {
        await telegramClient.editMessageText({
          chat_id: chatId,
          message_id: cq.message.message_id,
          text: (cq.message.text || '') + '\n\n✅ <b>Куратор уведомлен и свяжется с вами в ближайшее время!</b>',
          parse_mode: 'HTML',
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

  // Curator acceptance
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

  // 15-min SLA Escalation Picker: assign curator to unassigned request
  if (data.startsWith('assign_pick:')) {
    const lotIdentifier = data.replace(/^assign_pick:/, '');
    if (userRole !== 'owner' && userRole !== 'employee') {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: '⛔ Только сотрудники платформы могут принимать заявки в работу.',
      });
      return;
    }

    try {
      const empId = binding?.assignedEmployeeId || binding?.userId;
      const res = await assignCuratorToLot({
        lotCode: lotIdentifier,
        employeeId: empId,
        actor: {
          id: binding.userId,
          role: binding.role,
          name: `${cq.from.first_name || ''} ${cq.from.last_name || ''}`.trim() || 'Куратор',
          email: binding.userEmail,
        },
      });

      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `✅ <b>Заявка #${escapeHtml(lotIdentifier)} успешно принята в работу!</b>\nКуратор: ${escapeHtml(res.employee.name)}`,
      });
    } catch (err: any) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `⚠️ Ошибка назначения: ${escapeHtml(err.message)}`,
      });
    }
    return;
  }

  // Stage change menu
  if (data.startsWith('stage_menu:')) {
    const lotCode = data.replace(/^stage_menu:/, '');
    const lot = await findLot(ydb, lotCode);

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

  // Set stage
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

  // Reply to chat
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

  // View Queue Shortcut: q_view:<lotCode>
  if (data.startsWith('q_view:')) {
    const lotCode = data.replace(/^q_view:/, '');
    await showQueue(chatId, binding, ydb, lotCode, cfg);
    return;
  }

  // =========================================================================
  // Quick Apply Step 1: bb_app:<lotCode>
  // =========================================================================
  if (data.startsWith('bb_app:')) {
    const lotCode = data.replace(/^bb_app:/, '');
    if (!binding) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `🔒 Для подачи заявки привяжите аккаунт на сайте:\n${cfg.PUBLIC_BASE_URL}`,
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Открыть сайт DomExit', url: cfg.PUBLIC_BASE_URL }]],
        },
      });
      return;
    }

    const lot = await findLot(ydb, lotCode);
    if (!lot) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Лот #${escapeHtml(lotCode)} не найден.`,
      });
      return;
    }

    const dropConfig = lot.dropConfig;
    if (dropConfig?.waveStatus === 'expired_closed' || dropConfig?.waveStatus === 'capped_closed') {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `🛑 Прием заявок по лоту #${escapeHtml(lotCode)} закрыт.`,
      });
      return;
    }

    const buyBox = ((await ydb.getItem('buy_boxes', `bb:${binding.userId}`)) || null) as BuyerBuyBox | null;
    const tier = buyBox?.tier || 'silver';

    // Gold exclusivity gate check
    if (dropConfig?.waveStatus === 'gold_wave' && tier !== 'gold') {
      const until = dropConfig.goldExclusiveUntil
        ? new Date(dropConfig.goldExclusiveUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : '';
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `🔒 <b>Окно Gold-инвесторов активно</b>\n\nПодача заявок для инвесторов уровня Silver откроется в ${until} MSK (после окончания эксклюзивного окна Gold).`,
      });
      return;
    }

    // Cap check
    if (dropConfig?.maxApplicationsCap && (dropConfig.currentValidApplications || 0) >= dropConfig.maxApplicationsCap) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `🛑 Лимит мест в очереди по лоту #${escapeHtml(lotCode)} исчерпан (${dropConfig.maxApplicationsCap}/${dropConfig.maxApplicationsCap}).`,
      });
      return;
    }

    const lotPrice = Number(lot.priceRub || lot.price || 0).toLocaleString('ru-RU');
    const text = [
      `⚡ <b>ПОДАЧА ЗАЯВКИ: ЛОТ #${escapeHtml(lotCode)}</b>`,
      `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b>`,
      `Цена предложения: <b>${lotPrice} ₽</b>`,
      ``,
      `<b>Шаг 1 из 2:</b> Выберите ценовое предложение:`,
    ].join('\n');

    const buttons = [
      [
        { text: '✅ По полной цене', callback_data: `bb_prc:${lotCode}:full` },
        { text: '🚀 Выше рынка (+2%)', callback_data: `bb_prc:${lotCode}:above` },
      ],
      [
        { text: '📉 С дисконтом (-5%)', callback_data: `bb_prc:${lotCode}:disc` },
        { text: '❌ Отмена', callback_data: 'cancel' },
      ],
    ];

    await telegramClient.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: buttons },
    });
    return;
  }

  // =========================================================================
  // Quick Apply Step 2: bb_prc:<lotCode>:<priceType>
  // =========================================================================
  if (data.startsWith('bb_prc:')) {
    const parts = data.replace(/^bb_prc:/, '').split(':');
    const lotCode = parts[0];
    const priceType = parts[1] || 'full';

    const priceLabel =
      priceType === 'above' ? 'Выше рынка (+2%)' : priceType === 'disc' ? 'С дисконтом (-5%)' : 'По полной цене';

    const text = [
      `⚡ <b>ПОДАЧА ЗАЯВКИ: ЛОТ #${escapeHtml(lotCode)}</b>`,
      `Ценовое предложение: <b>${priceLabel}</b>`,
      ``,
      `<b>Шаг 2 из 2:</b> Подтвердите условия выхода на сделку:`,
      `• Готовы ли вы выйти на согласование за <b>24 часа</b>?`,
      `• Готовы ли вы внести обеспечительный депозит за <b>48 часов</b>?`,
    ].join('\n');

    const buttons = [
      [{ text: '⚡ 24ч выход + 48ч депозит', callback_data: `bb_cfm:${lotCode}:${priceType}:both` }],
      [
        { text: '⏱ Только выход 24ч', callback_data: `bb_cfm:${lotCode}:${priceType}:view` },
        { text: '💰 Только депозит 48ч', callback_data: `bb_cfm:${lotCode}:${priceType}:dep` },
      ],
      [{ text: '❌ Отмена', callback_data: 'cancel' }],
    ];

    await telegramClient.sendMessage({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: buttons },
    });
    return;
  }

  // =========================================================================
  // Quick Apply Step 3 (Execution): bb_cfm:<lotCode>:<priceType>:<speed>
  // =========================================================================
  if (data.startsWith('bb_cfm:')) {
    const parts = data.replace(/^bb_cfm:/, '').split(':');
    const lotCode = parts[0];
    const priceType = parts[1] || 'full';
    const speed = parts[2] || 'both';

    if (!binding) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: 'Для завершения подачи заявки авторизуйтесь на сайте DomExit.',
      });
      return;
    }

    // 5A Quota check
    const quotaRes = await consumeQuota({
      scope: 'buyer_app_telegram',
      actorKey: binding.userId,
      limit: 10,
      windowSec: 86400,
    });
    if (!quotaRes.allowed) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `⚠️ Превышен лимит заявок (${quotaRes.limit} в сутки). Попробуйте позже.`,
      });
      return;
    }

    const lot = await findLot(ydb, lotCode);
    if (!lot) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `❌ Лот #${escapeHtml(lotCode)} не найден.`,
      });
      return;
    }

    const targetLotCode = lot.lotCode || lotCode;

    // Check existing application
    const allApps = await findLotApplications(ydb, targetLotCode);
    const existing = (allApps || []).find(
      (a: any) =>
        (a.lotCode === targetLotCode || a.lotCode === lotCode) &&
        a.userId === binding.userId &&
        a.queueStatus !== 'withdrawn'
    );
    if (existing) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `⚠️ Вы уже подали заявку на лот #${escapeHtml(targetLotCode)}. Статус: <b>${escapeHtml(existing.queueStatus || 'в очереди')}</b>`,
      });
      return;
    }

    const buyBox: BuyerBuyBox =
      ((await ydb.getItem('buy_boxes', `bb:${binding.userId}`)) as BuyerBuyBox) || {
        id: `bb:${binding.userId}`,
        userId: binding.userId,
        active: true,
        cities: [lot.city || 'spb'],
        districts: [],
        complexNames: lot.complexName ? [lot.complexName] : [],
        dealTracks: [lot.dealTrack || 'ddu_cession'],
        rooms: [lot.rooms || '1k'],
        maxBudgetRub: Number(lot.priceRub || lot.price || 15000000),
        minDiscountPercent: 5,
        paymentMethod: 'cash_100',
        preferredBanks: [],
        goal: 'living',
        readinessHours: 24,
        tier: 'silver',
        reliabilityScore: 100,
        noShowCount: 0,
        completedViewingsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

    const priceAcceptance: PriceAcceptance =
      priceType === 'above' ? 'above_asking' : priceType === 'disc' ? 'discount_requested' : 'full_price';
    const readiness24h = speed === 'both' || speed === 'view';
    const deposit48h = speed === 'both' || speed === 'dep';

    const matchRes = computeMatchScore(lot, buyBox);
    const closingRes = computeClosingScore(
      { priceAcceptance, readiness24h, deposit48h, ndaSigned: true },
      buyBox,
      lot
    );

    const nowIso = new Date().toISOString();
    const newApp: BuyerApplication = {
      id: `app:${crypto.randomUUID()}`,
      lotCode: targetLotCode,
      userId: binding.userId,
      userEmail: binding.userEmail || '',
      userName: `${cq.from?.first_name || ''} ${cq.from?.last_name || ''}`.trim() || 'Инвестор Telegram',
      priceAcceptance,
      readiness24h,
      deposit48h,
      ndaSigned: true,
      matchScore: matchRes.score,
      closingScore: closingRes.closingScore,
      queueStatus: 'pending_review',
      createdAt: nowIso,
    };

    await ydb.putItem('buyer_applications', newApp);

    // Update dropConfig count if applicable
    if (lot.dropConfig) {
      lot.dropConfig.currentValidApplications = (lot.dropConfig.currentValidApplications || 0) + 1;
      if (lot.dropConfig.currentValidApplications >= lot.dropConfig.maxApplicationsCap) {
        lot.dropConfig.waveStatus = 'capped_closed';
      }
      await ydb.putItem('lots', lot);
    }

    await recordJournalEvent({
      action: 'CREATE',
      collection: 'buyer_applications',
      recordId: newApp.id,
      actor: { userId: binding.userId, role: binding.role, email: binding.userEmail },
      payload: { lotCode: targetLotCode, closingScore: closingRes.closingScore, matchScore: matchRes.score },
    });

    // Notify staff
    const staffNotice =
      `⚡ <b>НОВАЯ ЗАЯВКА В ОЧЕРЕДЬ ЧЕРЕЗ TELEGRAM: ЛОТ #${escapeHtml(targetLotCode)}</b>\n` +
      `Инвестор: <b>${escapeHtml(newApp.userName || newApp.userEmail || 'Инвестор')}</b> (${escapeHtml((buyBox.tier || 'silver').toUpperCase())})\n` +
      `Closing Score: <b>${closingRes.closingScore}/105</b> (Match: ${matchRes.score}%)\n` +
      `Выход 24ч: ${readiness24h ? 'Да' : 'Нет'}, Депозит 48ч: ${deposit48h ? 'Да' : 'Нет'}`;
    void notifyStaffTg(staffNotice);

    // Confirmation message to user
    const confirmationText = [
      `🎉 <b>Заявка на лот #${escapeHtml(targetLotCode)} успешно принята!</b>`,
      ``,
      `• Ваш Closing Score: <b>${closingRes.closingScore}/105</b>`,
      `• Совпадение Buy-Box: <b>${matchRes.score}%</b>`,
      `• Уровень инвестора: <b>${escapeHtml((buyBox.tier || 'silver').toUpperCase())}</b>`,
      ``,
      `Куратор рассмотрит заявку в приоритетном порядке. Вы получите мгновенное уведомление при присвоении приоритета №1!`,
    ].join('\n');

    await telegramClient.sendMessage({
      chat_id: chatId,
      text: confirmationText,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Другие совпадения', callback_data: 'cmd_matches' }],
          [{ text: '📋 Главное меню', callback_data: 'menu' }],
        ],
      },
    });
    return;
  }

  // =========================================================================
  // Hybrid Queue: Select Priority #1 & Reserve (q_sel:<lotCode>)
  // =========================================================================
  if (data.startsWith('q_sel:')) {
    const lotCode = data.replace(/^q_sel:/, '');
    if (userRole !== 'owner' && userRole !== 'employee') {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: '⛔ Только сотрудники могут распределять приоритеты очереди.',
      });
      return;
    }

    const lot = await findLot(ydb, lotCode);
    const targetLotCode = lot?.lotCode || lotCode;

    const lotApps = (await findLotApplications(ydb, targetLotCode)).filter(
      (a: any) => a.queueStatus !== 'withdrawn'
    );

    if (lotApps.length === 0) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `⚠️ По лоту #${escapeHtml(targetLotCode)} нет доступных заявок.`,
      });
      return;
    }

    const bbMap = new Map<string, any>();
    const uniqueUserIds = Array.from(new Set(lotApps.map((a: any) => a.userId).filter(Boolean)));
    const boxes = await Promise.all(
      uniqueUserIds.map((uid) => ydb.getItem('buy_boxes', `bb:${uid}`).catch(() => null))
    );
    for (let i = 0; i < uniqueUserIds.length; i++) {
      if (boxes[i]) bbMap.set(uniqueUserIds[i], boxes[i]);
    }

    const enriched = lotApps.map((a: any) => ({
      ...a,
      tier: bbMap.get(a.userId)?.tier || 'silver',
      reliabilityScore: bbMap.get(a.userId)?.reliabilityScore ?? 100,
      noShowCount: bbMap.get(a.userId)?.noShowCount ?? 0,
    }));

    const ranked = rankApplications(enriched);
    const now = new Date();
    const viewingDeadlineAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    const depositDeadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

    for (let i = 0; i < ranked.length; i++) {
      const app = ranked[i];
      if (i === 0) {
        app.queueStatus = 'priority_1';
        app.viewingDeadlineAt = viewingDeadlineAt;
        app.depositDeadlineAt = depositDeadlineAt;
      } else if (i === 1) {
        app.queueStatus = 'reserve_2';
      } else if (i === 2) {
        app.queueStatus = 'reserve_3';
      } else {
        app.queueStatus = 'waitlist';
      }
      await ydb.putItem('buyer_applications', app);
    }

    const topApp = ranked[0];
    const topName = escapeHtml(topApp.userName || topApp.userEmail || 'Покупатель');

    await recordJournalEvent({
      action: 'UPDATE',
      collection: 'buyer_applications',
      recordId: topApp.id || '',
      actor: { userId: binding.userId, role: binding.role, email: binding.userEmail },
      payload: { action: 'select_priority', lotCode: targetLotCode, priority1UserId: topApp.userId },
    });

    // Notify Priority 1 buyer
    const buyerNotice =
      `🌟 <b>ПОЗДРАВЛЯЕМ! ВАША ЗАЯВКА ВЫБРАНА В ПРИОРИТЕТ №1 [Лот #${escapeHtml(targetLotCode)}]</b>\n\n` +
      `ЖК: <b>${escapeHtml(lot?.complexName || 'Не указан')}</b>\n` +
      `⏱ Дедлайн согласования просмотра: <b>24 часа</b> (до ${new Date(viewingDeadlineAt).toLocaleString('ru-RU')})\n` +
      `💰 Дедлайн обеспечительного платежа: <b>48 часов</b> (до ${new Date(depositDeadlineAt).toLocaleString('ru-RU')})\n\n` +
      `<i>Куратор свяжется с вами в ближайшее время для фиксации времени просмотра!</i>`;
    if (topApp.userId) {
      void notifyUserTg(topApp.userId, buyerNotice);
    }

    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `👑 <b>Приоритет распределен для лота #${escapeHtml(targetLotCode)}</b>:`,
        ``,
        `🥇 <b>№1 (Приоритет):</b> ${topName}`,
        `• Closing Score: <b>${topApp.closingScore}/105</b>`,
        `• Дедлайн просмотра (24ч): <b>${new Date(viewingDeadlineAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b>`,
        `• Дедлайн депозита (48ч): <b>${new Date(depositDeadlineAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b>`,
        ``,
        `🥈 В резерве: <b>${ranked.length - 1} кандидатов</b>`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭ Передать очередь №2', callback_data: `q_prom:${targetLotCode}` }],
          [{ text: '📋 Посмотреть очередь', callback_data: `q_view:${targetLotCode}` }],
        ],
      },
    });
    return;
  }

  // =========================================================================
  // Hybrid Queue: Promote Reserve to Priority #1 (q_prom:<lotCode>)
  // =========================================================================
  if (data.startsWith('q_prom:')) {
    const lotCode = data.replace(/^q_prom:/, '');
    if (userRole !== 'owner' && userRole !== 'employee') {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: '⛔ Только сотрудники могут передавать очередь кандидатам из резерва.',
      });
      return;
    }

    const lot = await findLot(ydb, lotCode);
    const targetLotCode = lot?.lotCode || lotCode;

    const lotApps = (await findLotApplications(ydb, targetLotCode)).filter(
      (a: any) => a.queueStatus !== 'withdrawn'
    );

    const currentP1 = lotApps.find((a: any) => a.queueStatus === 'priority_1');
    if (currentP1) {
      currentP1.queueStatus = 'expired';
      await ydb.putItem('buyer_applications', currentP1);
    }

    const nextCandidate =
      lotApps.find((a: any) => a.queueStatus === 'reserve_2') ||
      lotApps.find((a: any) => a.queueStatus === 'reserve_3') ||
      lotApps.find((a: any) => a.queueStatus === 'waitlist' || a.queueStatus === 'pending_review');

    if (!nextCandidate) {
      await telegramClient.sendMessage({
        chat_id: chatId,
        text: `⚠️ В резерве по лоту #${escapeHtml(targetLotCode)} больше нет кандидатов.`,
      });
      return;
    }

    const now = new Date();
    const viewingDeadlineAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    const depositDeadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

    nextCandidate.queueStatus = 'priority_1';
    nextCandidate.viewingDeadlineAt = viewingDeadlineAt;
    nextCandidate.depositDeadlineAt = depositDeadlineAt;
    delete nextCandidate.deadlineAlertedAt;
    await ydb.putItem('buyer_applications', nextCandidate);

    // Promote reserve_3 to reserve_2 if exists
    const r3 = lotApps.find((a: any) => a.queueStatus === 'reserve_3');
    if (r3) {
      r3.queueStatus = 'reserve_2';
      await ydb.putItem('buyer_applications', r3);
    }

    await recordJournalEvent({
      action: 'UPDATE',
      collection: 'buyer_applications',
      recordId: nextCandidate.id || '',
      actor: { userId: binding.userId, role: binding.role, email: binding.userEmail },
      payload: { action: 'promote_queue', lotCode: targetLotCode, newPriority1UserId: nextCandidate.userId },
    });

    const nextName = escapeHtml(nextCandidate.userName || nextCandidate.userEmail || 'Кандидат №2');

    // Notify promoted buyer
    const promoNotice =
      `🌟 <b>ОЧЕРЕДЬ ПЕРЕДАНА ВАМ: ПРИОРИТЕТ №1 [Лот #${escapeHtml(targetLotCode)}]</b>\n\n` +
      `Кандидат №1 не подтвердил выход на сделку в срок. Право преимущественного бронирования перешло к вам!\n` +
      `⏱ Дедлайн просмотра: <b>24 часа</b>\n` +
      `💰 Дедлайн депозита: <b>48 часов</b>\n\n` +
      `<i>Куратор свяжется с вами прямо сейчас!</i>`;
    if (nextCandidate.userId) {
      void notifyUserTg(nextCandidate.userId, promoNotice);
    }

    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `⏭ <b>Очередь по лоту #${escapeHtml(targetLotCode)} передана кандидату из резерва!</b>`,
        ``,
        `👑 <b>Новый приоритет №1:</b> ${nextName}`,
        `• Closing Score: <b>${nextCandidate.closingScore}/105</b>`,
        `• Дедлайн просмотра (24ч): <b>${new Date(viewingDeadlineAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b>`,
        `• Дедлайн депозита (48ч): <b>${new Date(depositDeadlineAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b>`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭ Передать очередь дальше', callback_data: `q_prom:${targetLotCode}` }],
          [{ text: '📋 Главное меню', callback_data: 'menu' }],
        ],
      },
    });
    return;
  }

  // Cancel
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
}
