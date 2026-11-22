import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody } from '../lib/http.js';
import { getConfig } from '../lib/config.js';
import { getActiveMessenger, getActiveMessengerName, getMessenger } from '../lib/messenger/messengerRegistry.js';
import { notificationDispatcher } from '../lib/notificationDispatcher.js';
import { logger } from '../lib/logger.js';

export async function handleMessenger(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const cfg = getConfig();
  const activeName = getActiveMessengerName();

  // GET /api/messenger/status
  if (subPath === '/status' && method === 'GET') {
    const activeProvider = getActiveMessenger();
    return json(event, 200, {
      ok: true,
      activeProvider: activeName,
      isConfigured: activeProvider.isConfigured(),
      supportedProviders: ['telegram', 'max', 'mock'],
      notificationDispatcherReady: Boolean(notificationDispatcher),
    });
  }

  // POST /api/messenger/max/webhook
  if (subPath === '/max/webhook' && method === 'POST') {
    if (activeName !== 'max') {
      return json(event, 503, {
        ok: false,
        message:
          'MAX messenger integration is ready on the backend but waiting for active provider configuration (MESSENGER_PROVIDER=max)',
        activeProvider: activeName,
      });
    }

    const secretHeader = event.headers?.['x-max-bot-api-secret'] || event.headers?.['x-max-secret'];
    if (cfg.MAX_WEBHOOK_SECRET && secretHeader !== cfg.MAX_WEBHOOK_SECRET) {
      logger.warn('[MaxWebhook] Unauthorized secret token mismatch', {
        event: 'MAX_WEBHOOK_UNAUTHORIZED',
      });
      return json(event, 401, { error: 'Unauthorized secret token' });
    }

    try {
      const body = parseBody<any>(event);
      const maxProvider = getMessenger('max');
      const parsedEvent = maxProvider.parseWebhookPayload(body);

      logger.info('[MaxWebhook] Received MAX event', {
        event: 'MAX_EVENT_RECEIVED',
        meta: {
          type: parsedEvent?.type,
          senderId: parsedEvent?.senderId,
          hasText: Boolean(parsedEvent?.text),
        },
      });

      return json(event, 200, { ok: true, processed: true });
    } catch (err: any) {
      logger.error('[MaxWebhook] Error processing webhook payload', {
        event: 'MAX_WEBHOOK_ERROR',
        meta: { error: err.message },
      });
      return json(event, 500, { error: 'Internal processing error' });
    }
  }

  return json(event, 404, { error: `Messenger route ${subPath} not found` });
}
