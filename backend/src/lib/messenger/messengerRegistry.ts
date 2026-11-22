import { IMessengerProvider } from './IMessengerProvider.js';
import { TelegramProvider } from './TelegramProvider.js';
import { MaxProvider } from './MaxProvider.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

class MockProvider implements IMessengerProvider {
  readonly name = 'mock' as const;
  isConfigured(): boolean {
    return true;
  }
  async sendMessage(params: any): Promise<any> {
    logger.info('[MockMessenger] sendMessage', { meta: { recipientId: params.recipientId } });
    return { ok: true, messageId: `mock_${Date.now()}` };
  }
  async sendNotification(params: any): Promise<any> {
    logger.info('[MockMessenger] sendNotification', { meta: { recipientId: params.recipientId, title: params.title } });
    return { ok: true };
  }
  parseWebhookPayload(body: any): any {
    return { type: 'message', senderId: 'mock_sender', text: body?.text, raw: body };
  }
}

const telegramProvider = new TelegramProvider();
const maxProvider = new MaxProvider();
const mockProvider = new MockProvider();

export function getMessenger(name: 'telegram' | 'max' | 'mock'): IMessengerProvider {
  switch (name) {
    case 'max':
      return maxProvider;
    case 'mock':
      return mockProvider;
    case 'telegram':
    default:
      return telegramProvider;
  }
}

export function getActiveMessenger(): IMessengerProvider {
  const cfg = getConfig();
  const providerName = (cfg.MESSENGER_PROVIDER || 'telegram').toLowerCase();

  if (providerName === 'max') {
    return maxProvider;
  }
  if (providerName === 'mock') {
    return mockProvider;
  }

  return telegramProvider;
}

export function getActiveMessengerName(): 'telegram' | 'max' | 'mock' {
  const cfg = getConfig();
  const providerName = (cfg.MESSENGER_PROVIDER || 'telegram').toLowerCase();
  if (providerName === 'max') return 'max';
  if (providerName === 'mock') return 'mock';
  return 'telegram';
}
