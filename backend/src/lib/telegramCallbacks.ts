import { telegramClient, escapeHtml } from './telegramClient.js';
import {
  assignCuratorToLot,
  transitionLotStage,
  STAGE_LABELS,
  STAGE_TRANSITIONS,
} from './telegramWorkflow.js';
import {
  showMainMenu,
  showStats,
  showTasks,
  showTeam,
  showMyDeals,
} from './telegramCommands.js';

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

  // Stage change menu
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
