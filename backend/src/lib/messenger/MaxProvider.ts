import https from 'node:https';
import { URL } from 'node:url';
import {
  IMessengerProvider,
  SendMessageParams,
  SendNotificationParams,
  SendMessageResult,
  MessengerIncomingEvent,
} from './IMessengerProvider.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

function makeHttpsPost(
  targetUrl: string,
  payload: Record<string, any>,
  headers: Record<string, string>,
  timeoutMs = 8000
): Promise<{ ok: boolean; result?: any; description?: string; status?: number }> {
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
          family: 4,
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            ...headers,
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
              resolve({
                ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
                status: res.statusCode,
                result: json,
              });
            } catch {
              resolve({
                ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
                status: res.statusCode,
                description: data,
              });
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

export class MaxProvider implements IMessengerProvider {
  readonly name = 'max' as const;

  isConfigured(): boolean {
    const cfg = getConfig();
    const token = cfg.MAX_BOT_TOKEN?.trim();
    return Boolean(token && token.length > 10 && !token.startsWith('['));
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const cfg = getConfig();
    if (!this.isConfigured()) {
      logger.info('[MaxProvider:Simulated] Message delivered in simulation mode', {
        event: 'MAX_MESSAGE_SIMULATED',
        meta: {
          recipientId: params.recipientId,
          textLength: params.text.length,
          preview: params.text.slice(0, 80),
        },
      });
      return {
        ok: true,
        messageId: `sim_max_${Date.now()}`,
        description: 'Simulated MAX messenger delivery (bot token not configured)',
      };
    }

    try {
      const baseUrl = cfg.MAX_API_BASE_URL?.trim() || 'https://api.max-messenger.ru/bot/v1';
      const endpoint = `${baseUrl}/messages/send`;
      const token = cfg.MAX_BOT_TOKEN?.trim() || '';

      const payload = {
        recipient_id: params.recipientId,
        text: params.text,
        parse_mode: params.parseMode || 'HTML',
        reply_markup: params.replyMarkup,
        reply_to_message_id: params.replyToMessageId,
      };

      const res = await makeHttpsPost(
        endpoint,
        payload,
        {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DomExit-MaxProvider/1.0',
        },
        8000
      );

      if (!res.ok) {
        logger.warn('[MaxProvider] API send failure', {
          event: 'MAX_API_SEND_FAIL',
          meta: { status: res.status, description: res.description },
        });
        return { ok: false, error: res.description || `HTTP ${res.status}` };
      }

      return {
        ok: true,
        messageId: res.result?.message_id || res.result?.id,
      };
    } catch (err: any) {
      logger.warn('[MaxProvider] Exception in sendMessage', {
        meta: { recipientId: params.recipientId, error: err.message },
      });
      return { ok: false, error: err.message };
    }
  }

  async sendNotification(params: SendNotificationParams): Promise<{ ok: boolean; error?: string }> {
    try {
      const text = [
        `🔔 <b>${params.title}</b>`,
        '',
        params.body,
        params.actionUrl ? `\n👉 <a href="${params.actionUrl}">${params.actionTitle || 'Перейти'}</a>` : '',
      ].filter(Boolean).join('\n');

      let replyMarkup: any = undefined;
      if (params.actionUrl && params.actionTitle) {
        replyMarkup = {
          buttons: [
            [{ text: params.actionTitle, url: params.actionUrl }],
          ],
        };
      }

      const res = await this.sendMessage({
        recipientId: params.recipientId,
        text,
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

    // MAX event structure normalization
    if (body.event === 'message' || body.type === 'message' || body.message) {
      const msg = body.message || body;
      const text = String(msg.text || '').trim();
      const isStart = text.startsWith('/start');
      const sender = msg.sender || msg.from || {};
      const senderName = [sender.first_name || sender.name, sender.last_name].filter(Boolean).join(' ');

      return {
        type: isStart ? 'start' : 'message',
        senderId: String(sender.id || msg.recipient_id || msg.chat_id || ''),
        senderName: senderName || undefined,
        senderUsername: sender.username || undefined,
        text: text || undefined,
        messageId: msg.message_id ? String(msg.message_id) : undefined,
        raw: body,
      };
    }

    if (body.event === 'callback' || body.type === 'callback' || body.callback) {
      const cb = body.callback || body;
      const sender = cb.sender || cb.from || {};
      const senderName = [sender.first_name || sender.name, sender.last_name].filter(Boolean).join(' ');

      return {
        type: 'callback',
        senderId: String(sender.id || cb.chat_id || ''),
        senderName: senderName || undefined,
        senderUsername: sender.username || undefined,
        callbackData: cb.data || cb.payload || undefined,
        messageId: cb.message_id ? String(cb.message_id) : undefined,
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
