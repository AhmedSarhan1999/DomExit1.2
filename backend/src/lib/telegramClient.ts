import https from 'node:https';
import { URL } from 'node:url';
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

let pendingWebhookReply: any = null;

export function setPendingWebhookReply(reply: any) {
  pendingWebhookReply = reply;
}

export function popPendingWebhookReply(): any {
  const r = pendingWebhookReply;
  pendingWebhookReply = null;
  return r;
}

function makeHttpsPostRequest<T = any>(
  targetUrl: string,
  payload: Record<string, any>,
  timeoutMs = 8000
): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const postData = JSON.stringify(payload);

      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          family: 4, // STRICT IPv4 - prevents hanging in dual-stack / IPv6-unrouted containers
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (parseErr: any) {
              resolve({ ok: false, description: `Invalid JSON response: ${parseErr.message}` });
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, description: `Request timed out after ${timeoutMs}ms` });
      });

      req.on('error', (err) => {
        resolve({ ok: false, description: err.message });
      });

      req.write(postData);
      req.end();
    } catch (err: any) {
      resolve({ ok: false, description: err.message });
    }
  });
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

  const baseUrl = cfg.TELEGRAM_API_BASE_URL?.trim() || 'https://api.telegram.org';
  const url = `${baseUrl}/bot${token}/${method}`;

  try {
    const data = await makeHttpsPostRequest<T>(url, payload, 8000);
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
    setPendingWebhookReply({
      method: 'sendMessage',
      chat_id: params.chat_id,
      text: params.text,
      parse_mode: params.parse_mode || 'HTML',
      reply_markup: params.reply_markup,
    });

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

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options: { parseMode?: 'HTML'; replyMarkup?: any } = {}
) {
  return await telegramClient.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: options.parseMode || 'HTML',
    reply_markup: options.replyMarkup,
  });
}
