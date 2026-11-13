import { create } from 'zustand';
import { PublicChannelsConfig } from '../types';
import { PublicChannelsRepository, DEFAULT_PUBLIC_CHANNELS } from '../dal/repositories/PublicChannelsRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';

interface PublicChannelsState {
  channels: PublicChannelsConfig;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  loadChannels: () => Promise<void>;
  updateChannels: (updates: Partial<PublicChannelsConfig>) => Promise<PublicChannelsConfig>;
}

export const usePublicChannelsStore = create<PublicChannelsState>((set) => {
  let initialChannels = DEFAULT_PUBLIC_CHANNELS;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('domexit_cached_public_channels');
      if (cached) {
        initialChannels = { ...DEFAULT_PUBLIC_CHANNELS, ...JSON.parse(cached) };
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Subscribe to real-time changes
  if (typeof window !== 'undefined') {
    DatabaseGateway.subscribe((collection) => {
      if (collection === 'platform_settings' || collection === 'demo_platform_settings' || collection === 'settings' || !collection) {
        PublicChannelsRepository.getChannels().then((data) => {
          set({ channels: data });
          try {
            localStorage.setItem('domexit_cached_public_channels', JSON.stringify(data));
          } catch {
            // Ignore storage errors
          }
        });
      }
    });
  }

  return {
    channels: initialChannels,
    isLoading: false,
    isSaving: false,
    error: null,

    loadChannels: async () => {
      set({ isLoading: true, error: null });
      try {
        const data = await PublicChannelsRepository.getChannels();
        set({ channels: data, isLoading: false });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('domexit_cached_public_channels', JSON.stringify(data));
          } catch {
            // Ignore storage errors
          }
        }
      } catch (err: any) {
        set({ error: err.message || 'Ошибка загрузки каналов', isLoading: false });
      }
    },

    updateChannels: async (updates: Partial<PublicChannelsConfig>) => {
      set({ isSaving: true, error: null });
      try {
        const updated = await PublicChannelsRepository.updateChannels(updates);
        set({ channels: updated, isSaving: false });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('domexit_cached_public_channels', JSON.stringify(updated));
          } catch {
            // Ignore storage errors
          }
        }
        return updated;
      } catch (err: any) {
        set({ error: err.message || 'Ошибка сохранения каналов', isSaving: false });
        throw err;
      }
    },
  };
});
