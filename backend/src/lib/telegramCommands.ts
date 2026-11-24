import { telegramClient, escapeHtml } from './telegramClient.js';
import {
  STAGE_LABELS,
  relayBridgedMessage,
  findTelegramBindingByChat,
} from './telegramWorkflow.js';
import { handleTelegramCallback } from './telegramCallbacks.js';
import { computeMatchScore, rankApplications } from './buyBoxEngine.js';
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
      { text: '📈 Радар /demand', callback_data: 'cmd_demand' },
    ]);
    buttons.push([
      { text: '📋 Задачи /tasks', callback_data: 'cmd_tasks' },
      { text: '👥 Команда /team', callback_data: 'cmd_team' },
    ]);
    buttons.push([
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
      { text: '🎯 Buy-Box /matches', callback_data: 'cmd_matches' },
    ]);
    buttons.push([
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

function formatRub(val: number | string | undefined): string {
  return Number(val || 0).toLocaleString('ru-RU');
}

function formatWave(wave?: string): string {
  switch (wave) {
    case 'gold_wave':
      return '🥇 Gold (24ч)';
    case 'silver_wave':
      return '🥈 Silver (открытая)';
    case 'capped_closed':
      return '🛑 Закрыт (квота)';
    case 'expired_closed':
      return '⌛ Закрыт (время)';
    default:
      return '🟢 Доступен';
  }
}

export async function showMatches(
  chatId: string | number,
  binding: any,
  ydb: any,
  cfg: any
): Promise<void> {
  if (!binding) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: `🔒 Для подбора объектов по Buy-Box привяжите аккаунт на сайте:\n${cfg.PUBLIC_BASE_URL}`,
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Открыть сайт DomExit', url: cfg.PUBLIC_BASE_URL }]],
      },
    });
    return;
  }

  const buyBox = await ydb.getItem('buy_boxes', `bb:${binding.userId}`);
  if (!buyBox || buyBox.active === false) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `🎯 <b>Buy-Box не настроен или выключен</b>`,
        ``,
        `Для автоматического подбора лотов настройте параметры в личном кабинете:`,
        `• Бюджет и желаемый дисконт`,
        `• Локации и жилые комплексы`,
        `• Способ оплаты и готовность к быстрому выходу`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [[{ text: '⚙️ Настроить Buy-Box', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }]],
      },
    });
    return;
  }

  const allLots = await ydb.scanAll('lots', 500);
  const activeLots = (allLots || []).filter((l: any) => {
    const status = l.status || 'available';
    if (status !== 'available' && status !== 'active') return false;
    if (l.dropConfig?.waveStatus === 'expired_closed' || l.dropConfig?.waveStatus === 'capped_closed') return false;
    return true;
  });

  const scoredLots: Array<{ lot: any; score: number; eligible: boolean }> = [];
  for (const lot of activeLots) {
    const matchRes = computeMatchScore(lot, buyBox);
    if (matchRes.score >= 50) {
      scoredLots.push({ lot, score: matchRes.score, eligible: matchRes.eligibleForDrop });
    }
  }

  scoredLots.sort((a, b) => b.score - a.score);
  const topMatches = scoredLots.slice(0, 5);

  if (topMatches.length === 0) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: [
        `🔍 <b>Подходящих предложений пока нет</b>`,
        ``,
        `По вашему Buy-Box (бюджет: до <b>${formatRub(buyBox.maxBudgetRub)} ₽</b>, дисконт от <b>${buyBox.minDiscountPercent}%</b>) на текущий момент нет активных совпадений.`,
        ``,
        `Как только появится объект с дисконтом, бот моментально пришлет уведомление!`,
      ].join('\n'),
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Главное меню', callback_data: 'menu' }],
          [{ text: '🌐 Каталог на сайте', url: `${cfg.PUBLIC_BASE_URL}/catalog` }],
        ],
      },
    });
    return;
  }

  const tierBadge = buyBox.tier === 'gold' ? '🥇 GOLD' : buyBox.tier === 'bronze' ? '🥉 BRONZE' : '🥈 SILVER';
  const lines: string[] = [
    `🎯 <b>ТОП-5 СОВПАДЕНИЙ ПО ВАШЕМУ BUY-BOX [${tierBadge}]</b>`,
    `Бюджет: <b>до ${formatRub(buyBox.maxBudgetRub)} ₽</b> | Дисконт: <b>от ${buyBox.minDiscountPercent}%</b>`,
    ``,
  ];

  const buttons: any[] = [];
  for (let i = 0; i < topMatches.length; i++) {
    const { lot, score } = topMatches[i];
    const lotPrice = formatRub(lot.priceRub || lot.price);
    const disc = lot.discountPercent || (lot.marketPriceRub ? Math.round(((lot.marketPriceRub - (lot.priceRub || lot.price)) / lot.marketPriceRub) * 100) : 0);
    const wave = formatWave(lot.dropConfig?.waveStatus);
    const cap = lot.dropConfig?.maxApplicationsCap;
    const current = lot.dropConfig?.currentValidApplications || 0;
    const remainingSeats = cap ? Math.max(0, cap - current) : null;

    lines.push(
      `<b>#${i + 1} Лот #${escapeHtml(lot.lotCode || lot.id)}</b> — ЖК «${escapeHtml(lot.complexName || 'Не указан')}»`,
      `• Совпадение: <b>${score}%</b> | Дисконт: <b>${disc}%</b>`,
      `• Цена: <b>${lotPrice} ₽</b> | Волна: <b>${wave}</b>`,
      remainingSeats !== null ? `• Свободных мест в очереди: <b>${remainingSeats}</b>` : '',
      ``
    );

    buttons.push([
      {
        text: `⚡ Подать заявку #${escapeHtml(lot.lotCode || lot.id)} (${score}%)`,
        callback_data: `bb_app:${lot.lotCode || lot.id}`,
      },
    ]);
  }

  buttons.push([{ text: '📋 Главное меню', callback_data: 'menu' }]);

  await telegramClient.sendMessage({
    chat_id: chatId,
    text: lines.filter(Boolean).join('\n'),
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function showQueue(
  chatId: string | number,
  binding: any,
  ydb: any,
  lotCodeInput: string,
  cfg: any
): Promise<void> {
  if (!binding || (binding.role !== 'owner' && binding.role !== 'employee')) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: '⛔ Просмотр очереди заявок доступен только сотрудникам платформы.',
    });
    return;
  }

  const lotCode = (lotCodeInput || '').trim();
  if (!lotCode) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: 'Использование команды: <code>/queue КОД_ЛОТА</code>\nНапример: <code>/queue SPB-001</code>',
    });
    return;
  }

  let lot = await ydb.getItem('lots', lotCode);
  if (!lot) {
    const allLots = await ydb.scanAll('lots', 500);
    lot = (allLots || []).find((l: any) => l.lotCode === lotCode || l.id === lotCode);
  }

  if (!lot) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: `❌ Лот #${escapeHtml(lotCode)} не найден в базе данных.`,
    });
    return;
  }

  const allApps = await ydb.scanAll('buyer_applications', 300);
  const targetLotCode = lot.lotCode || lotCode;
  const lotApps = (allApps || []).filter(
    (a: any) => (a.lotCode === lotCode || a.lotCode === targetLotCode) && a.queueStatus !== 'withdrawn'
  );

  if (lotApps.length === 0) {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: `📋 <b>Очередь по лоту #${escapeHtml(targetLotCode)}</b>\n\nЗаявок от инвесторов пока нет.`,
    });
    return;
  }

  const allBuyBoxes = await ydb.scanAll('buy_boxes', 300);
  const bbMap = new Map<string, any>();
  for (const bb of allBuyBoxes || []) {
    bbMap.set(bb.userId, bb);
  }

  const enriched = lotApps.map((a: any) => {
    const bb = bbMap.get(a.userId);
    return {
      ...a,
      tier: bb?.tier || 'silver',
      reliabilityScore: bb?.reliabilityScore ?? 100,
      noShowCount: bb?.noShowCount ?? 0,
    };
  });

  const ranked = rankApplications(enriched);

  const lines: string[] = [
    `📋 <b>ГИБРИДНАЯ ОЧЕРЕДЬ: ЛОТ #${escapeHtml(targetLotCode)}</b>`,
    `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b> | Всего заявок: <b>${ranked.length}</b>`,
    `Волна: <b>${formatWave(lot.dropConfig?.waveStatus)}</b>`,
    ``,
  ];

  for (const app of (ranked as any[]).slice(0, 5)) {
    const statusIcon = app.queueStatus === 'priority_1' ? '👑' : app.queueStatus?.startsWith('reserve') ? '🥈' : '🔹';
    const tierIcon = app.tier === 'gold' ? '🥇' : app.tier === 'bronze' ? '🥉' : '🥈';
    const name = escapeHtml(app.userName || app.userEmail || 'Покупатель');

    lines.push(
      `${statusIcon} <b>#${app.queuePosition || 1} ${name}</b> [${tierIcon} ${escapeHtml((app.tier || 'silver').toUpperCase())}]`,
      `• Closing Score: <b>${app.closingScore}/105</b> (Match: ${app.matchScore}%)`,
      `• Оплата: <b>${escapeHtml(app.paymentMethod || 'кэш 100%')}</b>`,
      `• Выход 24ч: ${app.readiness24h ? '✅' : '❌'} | Депозит 48ч: ${app.deposit48h ? '✅' : '❌'}`,
      app.viewingDeadlineAt ? `• Срок просмотра: <i>${escapeHtml(app.viewingDeadlineAt)}</i>` : '',
      app.depositDeadlineAt ? `• Срок депозита: <i>${escapeHtml(app.depositDeadlineAt)}</i>` : '',
      ``
    );
  }

  const buttons = [
    [
      { text: '👑 Выбрать №1 + Резерв', callback_data: `q_sel:${targetLotCode}` },
      { text: '⏭ Передать очередь №2', callback_data: `q_prom:${targetLotCode}` },
    ],
    [{ text: '📋 Главное меню', callback_data: 'menu' }],
  ];

  await telegramClient.sendMessage({
    chat_id: chatId,
    text: lines.filter(Boolean).join('\n'),
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function showDemand(
  chatId: string | number,
  binding: any,
  ydb: any,
  cfg: any
): Promise<void> {
  if (!binding || binding.role !== 'owner') {
    await telegramClient.sendMessage({
      chat_id: chatId,
      text: '⛔ Радар спроса доступен только владельцу платформы.',
    });
    return;
  }

  const allBuyBoxes = await ydb.scanAll('buy_boxes', 500);
  const activeBoxes = (allBuyBoxes || []).filter((b: any) => b.active !== false);

  let spb = 0;
  let msk = 0;
  let otherCities = 0;
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let ddu = 0;
  let secondary = 0;
  let totalBudget = 0;
  let totalDiscount = 0;

  for (const bb of activeBoxes) {
    if (bb.cities?.includes('spb')) spb++;
    if (bb.cities?.includes('msk')) msk++;
    if (bb.cities?.some((c: string) => c !== 'spb' && c !== 'msk')) otherCities++;

    if (bb.tier === 'gold') gold++;
    else if (bb.tier === 'bronze') bronze++;
    else silver++;

    if (bb.dealTracks?.includes('ddu_cession')) ddu++;
    if (bb.dealTracks?.includes('secondary_dkp')) secondary++;

    totalBudget += Number(bb.maxBudgetRub || 0);
    totalDiscount += Number(bb.minDiscountPercent || 0);
  }

  const count = activeBoxes.length || 1;
  const avgBudget = Math.round(totalBudget / count);
  const avgDiscount = (totalDiscount / count).toFixed(1);

  const text = [
    `📊 <b>РАДАР СПРОСА И ЛИКВИДНОСТИ (BUY-BOX RADAR)</b>`,
    ``,
    `👥 Всего активных инвесторов: <b>${activeBoxes.length}</b>`,
    ``,
    `<b>🏙 По городам:</b>`,
    `• Санкт-Петербург: <b>${spb}</b>`,
    `• Москва: <b>${msk}</b>`,
    `• Другие регионы: <b>${otherCities}</b>`,
    ``,
    `<b>🏅 По уровням верификации:</b>`,
    `• 🥇 Gold (Кэш 100%, 24ч выход): <b>${gold}</b>`,
    `• 🥈 Silver (Одобренная ипотека): <b>${silver}</b>`,
    `• 🥉 Bronze (Без подтверждения): <b>${bronze}</b>`,
    ``,
    `<b>📑 По типам сделок:</b>`,
    `• ДДУ / Переуступка: <b>${ddu}</b>`,
    `• Вторичка / ДКП: <b>${secondary}</b>`,
    ``,
    `💰 Средний макс. бюджет: <b>${formatRub(avgBudget)} ₽</b>`,
    `📉 Средний ожидаемый дисконт: <b>${avgDiscount}%</b>`,
  ].join('\n');

  await telegramClient.sendMessage({
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Обновить сводку', callback_data: 'cmd_demand' }],
        [{ text: '📋 Главное меню', callback_data: 'menu' }],
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

      // 1:1 Invariant Guard: Prevent binding collisions and silent overwrites
      const existingChatBinding = await ydb.getItem('telegram_bindings', `chat:${chatId}`);
      if (existingChatBinding && existingChatBinding.userId !== linkToken.userId) {
        logger.warn('Telegram binding collision rejected', {
          event: 'TELEGRAM_BIND_COLLISION',
          meta: {
            chatId,
            attemptedUserId: linkToken.userId,
            existingUserId: existingChatBinding.userId,
            existingEmail: existingChatBinding.userEmail,
          },
        });
        await telegramClient.sendMessage({
          chat_id: chatId,
          text: [
            `⚠️ <b>Конфликт привязки Telegram-аккаунта</b>`,
            ``,
            `Этот Telegram-аккаунт уже привязан к профилю <b>${escapeHtml(existingChatBinding.userEmail || existingChatBinding.userId)}</b>.`,
            ``,
            `Платформа DomExit обеспечивает строгое разделение прав доступа (1:1). Чтобы перепривязать этот Telegram к другому пользователю:`,
            `1. Отправьте команду /unlink в этот чат, или`,
            `2. Нажмите кнопку отвязки ниже, затем повторите привязку.`,
          ].join('\n'),
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Отвязать текущий профиль', callback_data: 'unlink' }],
              [{ text: '🌐 Открыть личный кабинет', url: `${cfg.PUBLIC_BASE_URL}/client/portal` }],
            ],
          },
        });
        return;
      }

      const existingUserBinding = await ydb.getItem('telegram_bindings', `user:${linkToken.userId}`);
      if (existingUserBinding && String(existingUserBinding.chatId) !== String(chatId)) {
        // Clean up stale previous chat binding to preserve strict 1:1 invariant
        await ydb.deleteItem('telegram_bindings', `chat:${existingUserBinding.chatId}`);
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

      // Synchronize Telegram handle into user profile record
      if (user) {
        user.telegram = msg.from?.username ? `@${msg.from.username}` : (user.telegram || '');
        user.telegramUsername = msg.from?.username || user.telegramUsername || '';
        user.telegramChatId = String(chatId);
        user.telegramBotUsername = msg.from?.username || user.telegramBotUsername || '';
        user.updatedAt = new Date().toISOString();
        await ydb.putItem('users', user);
      }

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

  // Command: /matches
  if (text === '/matches') {
    await showMatches(chatId, binding, ydb, cfg);
    return;
  }

  // Command: /queue
  if (text.startsWith('/queue')) {
    const parts = text.split(/\s+/);
    const lotCode = parts[1] || '';
    await showQueue(chatId, binding, ydb, lotCode, cfg);
    return;
  }

  // Command: /demand
  if (text === '/demand') {
    await showDemand(chatId, binding, ydb, cfg);
    return;
  }

  // Command: /unlink
  if (text === '/unlink') {
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
