import { telegramClient, escapeHtml } from './telegramClient.js';
import {
  STAGE_LABELS,
  relayBridgedMessage,
  findTelegramBindingByChat,
} from './telegramWorkflow.js';
import { handleTelegramCallback } from './telegramCallbacks.js';
import { logger } from './logger.js';

export async function showMainMenu(chatId: string | number, binding: any, cfg: any): Promise<void> {
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

export async function showStats(chatId: string | number, binding: any, ydb: any, cfg: any): Promise<void> {
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

export async function showTasks(chatId: string | number, binding: any, ydb: any, cmd: string, cfg: any): Promise<void> {
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

export async function showTeam(chatId: string | number, binding: any, ydb: any, cfg: any): Promise<void> {
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

export async function showMyDeals(chatId: string | number, binding: any, ydb: any, cfg: any): Promise<void> {
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

export async function handleTelegramMessage(
  msg: any,
  binding: any,
  ydb: any,
  cfg: any
): Promise<void> {
  const chatId = msg.chat?.id;
  if (!chatId) return;

  const text = (msg.text || '').trim();

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

  // Native Telegram Reply Bridge: User swiped and replied to a bot message
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

  // Active Reply Context (if user pressed "💬 Ответить" earlier)
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

  // Default fallback (Always respond politely with menu button)
  await telegramClient.sendMessage({
    chat_id: chatId,
    text: 'Команда не распознана. Введите /menu для вызова главного меню или /cancel для отмены.',
    reply_markup: {
      inline_keyboard: [[{ text: '📋 Главное меню', callback_data: 'menu' }]],
    },
  });
}

export async function processTelegramUpdate(update: any, ydb: any, cfg: any): Promise<void> {
  let currentChatId: number | string | undefined =
    update.message?.chat?.id || update.callback_query?.message?.chat?.id || update.callback_query?.from?.id;

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      currentChatId = cq.message?.chat?.id || cq.from?.id;
      const binding = currentChatId ? await findTelegramBindingByChat(currentChatId) : null;
      await handleTelegramCallback(cq, binding, ydb, cfg);
      return;
    }

    if (update.message) {
      const msg = update.message;
      currentChatId = msg.chat?.id;
      const binding = currentChatId ? await findTelegramBindingByChat(currentChatId) : null;
      await handleTelegramMessage(msg, binding, ydb, cfg);
      return;
    }
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
