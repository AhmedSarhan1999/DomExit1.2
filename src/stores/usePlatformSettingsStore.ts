import { create } from 'zustand';
import { CompanyLegalProfile, PublicChannelsConfig } from '../types';
import { LegalSettings } from '../types/legal';
import { CompanyProfileRepository, DEFAULT_COMPANY_LEGAL_PROFILE } from '../dal/repositories/CompanyProfileRepository';
import { PublicChannelsRepository, DEFAULT_PUBLIC_CHANNELS } from '../dal/repositories/PublicChannelsRepository';
import { LegalRepository, DEFAULT_LEGAL_SETTINGS } from '../dal/repositories/LegalRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';

export interface UnifiedPlatformSettings {
  // 15 Company Profile Fields (152-FZ / 38-FZ)
  fullName: string;
  shortName: string;
  entityType: 'ООО' | 'АО' | 'ИП';
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  postalAddress: string;
  moscowOffice: string;
  generalDirector: string;
  dpoName: string;
  privacyEmail: string;
  officialPhone: string;
  bankName: string;
  bik: string;
  checkingAccount: string;
  correspondentAccount: string;

  // 7 Communication Channels & Social Links
  telegramChannelUrl: string;
  telegramBotUrl: string;
  maxProfileUrl: string;
  vkCommunityUrl: string;
  hotlinePhone: string;
  supportEmail: string;

  updatedAt: string;
}

export const DEFAULT_UNIFIED_SETTINGS: UnifiedPlatformSettings = {
  fullName: DEFAULT_COMPANY_LEGAL_PROFILE.fullName,
  shortName: DEFAULT_COMPANY_LEGAL_PROFILE.shortName,
  entityType: DEFAULT_COMPANY_LEGAL_PROFILE.entityType,
  inn: DEFAULT_COMPANY_LEGAL_PROFILE.inn,
  kpp: DEFAULT_COMPANY_LEGAL_PROFILE.kpp,
  ogrn: DEFAULT_COMPANY_LEGAL_PROFILE.ogrn,
  legalAddress: DEFAULT_COMPANY_LEGAL_PROFILE.legalAddress,
  postalAddress: DEFAULT_COMPANY_LEGAL_PROFILE.postalAddress,
  moscowOffice: DEFAULT_LEGAL_SETTINGS.moscow_office,
  generalDirector: DEFAULT_COMPANY_LEGAL_PROFILE.generalDirector,
  dpoName: DEFAULT_COMPANY_LEGAL_PROFILE.dpoName,
  privacyEmail: DEFAULT_COMPANY_LEGAL_PROFILE.privacyEmail,
  officialPhone: DEFAULT_COMPANY_LEGAL_PROFILE.officialPhone,
  bankName: DEFAULT_COMPANY_LEGAL_PROFILE.bankName,
  bik: DEFAULT_COMPANY_LEGAL_PROFILE.bik,
  checkingAccount: DEFAULT_COMPANY_LEGAL_PROFILE.checkingAccount,
  correspondentAccount: DEFAULT_COMPANY_LEGAL_PROFILE.correspondentAccount,

  telegramChannelUrl: DEFAULT_PUBLIC_CHANNELS.telegramChannelUrl,
  telegramBotUrl: DEFAULT_PUBLIC_CHANNELS.telegramBotUrl,
  maxProfileUrl: DEFAULT_PUBLIC_CHANNELS.maxProfileUrl,
  vkCommunityUrl: DEFAULT_PUBLIC_CHANNELS.vkCommunityUrl,
  hotlinePhone: DEFAULT_PUBLIC_CHANNELS.hotlinePhone,
  supportEmail: DEFAULT_PUBLIC_CHANNELS.supportEmail,

  updatedAt: new Date().toISOString(),
};

interface PlatformSettingsStoreState {
  settings: UnifiedPlatformSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  loadSettings: () => Promise<UnifiedPlatformSettings>;
  saveLegalProfile: (updates: Partial<CompanyLegalProfile> & { moscowOffice?: string }) => Promise<UnifiedPlatformSettings>;
  saveChannels: (updates: Partial<PublicChannelsConfig>) => Promise<UnifiedPlatformSettings>;
  saveAllSettings: (updates: Partial<UnifiedPlatformSettings>) => Promise<UnifiedPlatformSettings>;
}

const LOCAL_STORAGE_KEY = 'domexit_cached_unified_settings';

export const usePlatformSettingsStore = create<PlatformSettingsStoreState>((set, get) => {
  // Load cached settings immediately for instant rendering
  let initial = DEFAULT_UNIFIED_SETTINGS;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        initial = { ...DEFAULT_UNIFIED_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
  }

  // Subscribe to real-time database changes
  if (typeof window !== 'undefined') {
    DatabaseGateway.subscribe((collection) => {
      if (
        collection === 'platform_settings' ||
        collection === 'legal_settings' ||
        collection === 'demo_platform_settings' ||
        !collection
      ) {
        get().loadSettings();
      }
    });
  }

  return {
    settings: initial,
    isLoading: false,
    isSaving: false,
    error: null,

    loadSettings: async () => {
      set({ isLoading: true, error: null });
      try {
        const [profile, channels, legal] = await Promise.all([
          CompanyProfileRepository.getProfile(),
          PublicChannelsRepository.getChannels(),
          LegalRepository.getSettings(),
        ]);

        const merged: UnifiedPlatformSettings = {
          fullName: legal.company_name || profile.fullName,
          shortName: legal.company_short_name || profile.shortName,
          entityType: profile.entityType || 'ООО',
          inn: legal.inn || profile.inn,
          kpp: legal.kpp || profile.kpp,
          ogrn: legal.ogrn || profile.ogrn,
          legalAddress: legal.legal_address || profile.legalAddress,
          postalAddress: profile.postalAddress || legal.legal_address,
          moscowOffice: legal.moscow_office || 'Москва, Пресненская наб., 12 (Башня Федерация)',
          generalDirector: profile.generalDirector || legal.dpo_name,
          dpoName: legal.dpo_name || profile.dpoName,
          privacyEmail: legal.privacy_email || profile.privacyEmail,
          officialPhone: legal.support_phone || profile.officialPhone,
          bankName: profile.bankName,
          bik: profile.bik,
          checkingAccount: profile.checkingAccount,
          correspondentAccount: profile.correspondentAccount,

          telegramChannelUrl: legal.social_links?.telegram_channel || channels.telegramChannelUrl,
          telegramBotUrl: legal.social_links?.telegram_bot || channels.telegramBotUrl,
          maxProfileUrl: legal.social_links?.max || channels.maxProfileUrl,
          vkCommunityUrl: legal.social_links?.vk || channels.vkCommunityUrl,
          hotlinePhone: legal.support_phone || channels.hotlinePhone,
          supportEmail: legal.legal_email || channels.supportEmail,

          updatedAt: new Date().toISOString(),
        };

        set({ settings: merged, isLoading: false });
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        }
        return merged;
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
        return get().settings;
      }
    },

    saveLegalProfile: async (updates) => {
      set({ isSaving: true, error: null });
      try {
        const current = get().settings;
        const updatedProfile = await CompanyProfileRepository.updateProfile({
          fullName: updates.fullName,
          shortName: updates.shortName,
          entityType: updates.entityType,
          inn: updates.inn,
          kpp: updates.kpp,
          ogrn: updates.ogrn,
          legalAddress: updates.legalAddress,
          postalAddress: updates.postalAddress,
          generalDirector: updates.generalDirector,
          dpoName: updates.dpoName,
          privacyEmail: updates.privacyEmail,
          officialPhone: updates.officialPhone,
          bankName: updates.bankName,
          bik: updates.bik,
          checkingAccount: updates.checkingAccount,
          correspondentAccount: updates.correspondentAccount,
        });

        const bankDetailsStr = `${updatedProfile.bankName} (БИК ${updatedProfile.bik}, р/с ${updatedProfile.checkingAccount}, к/с ${updatedProfile.correspondentAccount})`;

        await LegalRepository.updateSettings({
          company_name: updatedProfile.fullName,
          company_short_name: updatedProfile.shortName,
          inn: updatedProfile.inn,
          kpp: updatedProfile.kpp,
          ogrn: updatedProfile.ogrn,
          legal_address: updatedProfile.legalAddress,
          moscow_office: updates.moscowOffice || current.moscowOffice,
          bank_details: bankDetailsStr,
          dpo_name: updatedProfile.dpoName,
          privacy_email: updatedProfile.privacyEmail,
          support_phone: updatedProfile.officialPhone,
        });

        const newSettings: UnifiedPlatformSettings = {
          ...current,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        set({ settings: newSettings, isSaving: false });
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
          localStorage.setItem('domexit_cached_company_profile', JSON.stringify(updatedProfile));
        }
        return newSettings;
      } catch (err: any) {
        set({ error: err.message, isSaving: false });
        throw err;
      }
    },

    saveChannels: async (updates) => {
      set({ isSaving: true, error: null });
      try {
        const current = get().settings;
        const updatedChannels = await PublicChannelsRepository.updateChannels(updates);

        await LegalRepository.updateSettings({
          support_phone: updates.hotlinePhone || current.hotlinePhone,
          legal_email: updates.supportEmail || current.supportEmail,
          social_links: {
            telegram_channel: updates.telegramChannelUrl || current.telegramChannelUrl,
            telegram_bot: updates.telegramBotUrl || current.telegramBotUrl,
            vk: updates.vkCommunityUrl || current.vkCommunityUrl,
            max: updates.maxProfileUrl || current.maxProfileUrl,
          },
        });

        const newSettings: UnifiedPlatformSettings = {
          ...current,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        set({ settings: newSettings, isSaving: false });
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
          localStorage.setItem('domexit_cached_public_channels', JSON.stringify(updatedChannels));
        }
        return newSettings;
      } catch (err: any) {
        set({ error: err.message, isSaving: false });
        throw err;
      }
    },

    saveAllSettings: async (updates) => {
      set({ isSaving: true, error: null });
      try {
        const current = get().settings;
        const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };

        await Promise.all([
          CompanyProfileRepository.updateProfile({
            fullName: merged.fullName,
            shortName: merged.shortName,
            entityType: merged.entityType,
            inn: merged.inn,
            kpp: merged.kpp,
            ogrn: merged.ogrn,
            legalAddress: merged.legalAddress,
            postalAddress: merged.postalAddress,
            generalDirector: merged.generalDirector,
            dpoName: merged.dpoName,
            privacyEmail: merged.privacyEmail,
            officialPhone: merged.officialPhone,
            bankName: merged.bankName,
            bik: merged.bik,
            checkingAccount: merged.checkingAccount,
            correspondentAccount: merged.correspondentAccount,
          }),
          PublicChannelsRepository.updateChannels({
            telegramChannelUrl: merged.telegramChannelUrl,
            telegramBotUrl: merged.telegramBotUrl,
            maxProfileUrl: merged.maxProfileUrl,
            vkCommunityUrl: merged.vkCommunityUrl,
            hotlinePhone: merged.hotlinePhone,
            supportEmail: merged.supportEmail,
          }),
          LegalRepository.updateSettings({
            company_name: merged.fullName,
            company_short_name: merged.shortName,
            inn: merged.inn,
            kpp: merged.kpp,
            ogrn: merged.ogrn,
            legal_address: merged.legalAddress,
            moscow_office: merged.moscowOffice,
            bank_details: `${merged.bankName} (БИК ${merged.bik}, р/с ${merged.checkingAccount}, к/с ${merged.correspondentAccount})`,
            dpo_name: merged.dpoName,
            privacy_email: merged.privacyEmail,
            support_phone: merged.hotlinePhone || merged.officialPhone,
            legal_email: merged.supportEmail,
            social_links: {
              telegram_channel: merged.telegramChannelUrl,
              telegram_bot: merged.telegramBotUrl,
              vk: merged.vkCommunityUrl,
              max: merged.maxProfileUrl,
            },
          }),
        ]);

        set({ settings: merged, isSaving: false });
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        }
        return merged;
      } catch (err: any) {
        set({ error: err.message, isSaving: false });
        throw err;
      }
    },
  };
});
