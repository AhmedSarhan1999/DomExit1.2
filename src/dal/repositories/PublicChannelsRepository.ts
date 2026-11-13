import { PublicChannelsConfig } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';

const COLLECTION = 'platform_settings';
const CHANNELS_ID = 'public_channels';

export const DEFAULT_PUBLIC_CHANNELS: PublicChannelsConfig = {
  id: CHANNELS_ID,
  telegramChannelUrl: 'https://t.me/domexit_ru',
  telegramBotUrl: 'https://t.me/domexit_bot',
  vipClubTelegramUrl: 'https://t.me/+domexit_vip_investors',
  maxProfileUrl: 'https://max.im/domexit',
  vkCommunityUrl: 'https://vk.com/domexit',
  hotlinePhone: '+7 (812) 900-00-00',
  supportEmail: 'info@domexit.ru',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

export class PublicChannelsRepository {
  static async getChannels(): Promise<PublicChannelsConfig> {
    const existing = await DatabaseGateway.getById<PublicChannelsConfig>(
      COLLECTION,
      CHANNELS_ID,
      [DEFAULT_PUBLIC_CHANNELS]
    );
    return existing || DEFAULT_PUBLIC_CHANNELS;
  }

  static async updateChannels(channels: Partial<PublicChannelsConfig>): Promise<PublicChannelsConfig> {
    const current = await this.getChannels();
    const updated: PublicChannelsConfig = {
      ...current,
      ...channels,
      id: CHANNELS_ID,
      updatedAt: new Date().toISOString(),
    };
    await DatabaseGateway.save<PublicChannelsConfig>(COLLECTION, updated);
    return updated;
  }
}
