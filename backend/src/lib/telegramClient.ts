import { getConfig } from './config.js';
import { logger } from './logger.js';

export function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isTelegramConfigured(): boolean {
  const cfg = getConfig();
  const token = cfg.TELEGRAM_BOT_TOKEN?.trim();
  return Boolean(token && !token.startsWith('[') && token.length > 20);
}

export async function callTelegramApi<T = any>(
  method: string,
  payload: Record<string, any> = {}
): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  const cfg = getConfig();
  const token = cfg.TELEGRAM_BOT_TOKEN?.trim();

  if (!token || !isTelegramConfigured()) {
    logger.warn(`Telegram API call ${method} skipped: bot not configured`, {
      event: 'TELEGRAM_NOT_CONFIGURED',
    });
    return { ok: false, description: 'Telegram bot not configured' };
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    const data: any = await res.json();
    if (!data.ok) {
      logger.warn(`Telegram API ${method} error: ${data.description}`, {
        event: 'TELEGRAM_API_ERROR',
        meta: { method, description: data.description, errorCode: data.error_code },
      });
    }
    return data;
  } catch (err: any) {
    logger.warn(`Telegram API call ${method} failed: ${err.message}`, {
      event: 'TELEGRAM_FETCH_FAIL',
      meta: { method, error: err.message },
    });
    return { ok: false, description: err.message };
  }
}

export const telegramClient = {
  isConfigured: isTelegramConfigured,

  escape: escapeHtml,

  sendMessage: async (params: {
    chat_id: number | string;
    text: string;
    parse_mode?: 'HTML';
    reply_markup?: any;
    reply_to_message_id?: number;
  }) => {
    return await callTelegramApi('sendMessage', {
      parse_mode: 'HTML',
      ...params,
    });
  },

  editMessageText: async (params: {
    chat_id: number | string;
    message_id: number;
    text: string;
    parse_mode?: 'HTML';
    reply_markup?: any;
  }) => {
    return await callTelegramApi('editMessageText', {
      parse_mode: 'HTML',
      ...params,
    });
  },

  answerCallbackQuery: async (params: {
    callback_query_id: string;
    text?: string;
    show_alert?: boolean;
  }) => {
    return await callTelegramApi('answerCallbackQuery', params);
  },

  setWebhook: async (params: {
    url: string;
    secret_token?: string;
    allowed_updates?: string[];
  }) => {
    return await callTelegramApi('setWebhook', params);
  },

  getWebhookInfo: async () => {
    return await callTelegramApi('getWebhookInfo', {});
  },

  setMyCommands: async (params: {
    commands: Array<{ command: string; description: string }>;
  }) => {
    return await callTelegramApi('setMyCommands', params);
  },
};
