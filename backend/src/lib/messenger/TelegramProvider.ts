import {
  IMessengerProvider,
  SendMessageParams,
  SendNotificationParams,
  SendMessageResult,
  MessengerIncomingEvent,
} from './IMessengerProvider.js';
import { telegramClient, escapeHtml } from '../telegramClient.js';
import { logger } from '../logger.js';

export class TelegramProvider implements IMessengerProvider {
  readonly name = 'telegram' as const;

  isConfigured(): boolean {
    return telegramClient.isConfigured();
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      const res = await telegramClient.sendMessage({
        chat_id: params.recipientId,
        text: params.text,
        parse_mode: (params.parseMode as any) || 'HTML',
        reply_markup: params.replyMarkup,
        reply_to_message_id: params.replyToMessageId ? Number(params.replyToMessageId) : undefined,
      });

      return {
        ok: Boolean(res.ok),
        messageId: res.result?.message_id ? String(res.result.message_id) : undefined,
        description: res.description,
        error: res.ok ? undefined : res.description,
      };
    } catch (err: any) {
      logger.warn('[TelegramProvider] Failed to send message', {
        meta: { recipientId: params.recipientId, error: err.message },
      });
      return { ok: false, error: err.message };
    }
  }

  async sendNotification(params: SendNotificationParams): Promise<{ ok: boolean; error?: string }> {
    try {
      const formattedText = [
        `🔔 <b>${escapeHtml(params.title)}</b>`,
        '',
        params.body,
      ].filter(Boolean).join('\n');

      let replyMarkup: any = undefined;
      if (params.actionUrl && params.actionTitle) {
        replyMarkup = {
          inline_keyboard: [
            [{ text: params.actionTitle, url: params.actionUrl }],
          ],
        };
      }

      const res = await this.sendMessage({
        recipientId: params.recipientId,
        text: formattedText,
        parseMode: 'HTML',
        replyMarkup,
      });

      return { ok: res.ok, error: res.error };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  parseWebhookPayload(body: any): MessengerIncomingEvent | null {
    if (!body || typeof body !== 'object') return null;

    if (body.message) {
      const msg = body.message;
      const text = String(msg.text || '').trim();
      const isStart = text.startsWith('/start');
      const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ');

      return {
        type: isStart ? 'start' : 'message',
        senderId: String(msg.chat?.id || msg.from?.id || ''),
        senderName: senderName || undefined,
        senderUsername: msg.from?.username || undefined,
        text: text || undefined,
        messageId: msg.message_id ? String(msg.message_id) : undefined,
        raw: body,
      };
    }

    if (body.callback_query) {
      const cq = body.callback_query;
      const senderId = String(cq.message?.chat?.id || cq.from?.id || '');
      const senderName = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(' ');

      return {
        type: 'callback',
        senderId,
        senderName: senderName || undefined,
        senderUsername: cq.from?.username || undefined,
        callbackData: cq.data || undefined,
        messageId: cq.message?.message_id ? String(cq.message.message_id) : undefined,
        raw: body,
      };
    }

    return {
      type: 'unknown',
      senderId: '',
      raw: body,
    };
  }
}
