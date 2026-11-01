import { create } from 'zustand';
import { CompanyLegalProfile } from '../types';
import { CompanyProfileRepository, DEFAULT_COMPANY_LEGAL_PROFILE } from '../dal/repositories/CompanyProfileRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';

interface CompanyProfileState {
  profile: CompanyLegalProfile;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<CompanyLegalProfile>) => Promise<CompanyLegalProfile>;
}

export const useCompanyProfileStore = create<CompanyProfileState>((set) => {
  // Try loading from localStorage synchronously for instant render
  let initialProfile = DEFAULT_COMPANY_LEGAL_PROFILE;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('domexit_cached_company_profile');
      if (cached) {
        initialProfile = { ...DEFAULT_COMPANY_LEGAL_PROFILE, ...JSON.parse(cached) };
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Subscribe to real-time changes
  if (typeof window !== 'undefined') {
    DatabaseGateway.subscribe((collection) => {
      if (collection === 'settings' || !collection) {
        CompanyProfileRepository.getProfile().then((data) => {
          set({ profile: data });
          try {
            localStorage.setItem('domexit_cached_company_profile', JSON.stringify(data));
          } catch {
            // Ignore storage errors
          }
        });
      }
    });
  }

  return {
    profile: initialProfile,
    isLoading: false,
    isSaving: false,
    error: null,

    loadProfile: async () => {
      set({ isLoading: true, error: null });
      try {
        const data = await CompanyProfileRepository.getProfile();
        set({ profile: data, isLoading: false });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('domexit_cached_company_profile', JSON.stringify(data));
          } catch {
            // Ignore storage errors
          }
        }
      } catch (err: any) {
        set({ error: err.message || 'Ошибка загрузки профиля', isLoading: false });
      }
    },

    updateProfile: async (updates: Partial<CompanyLegalProfile>) => {
      set({ isSaving: true, error: null });
      try {
        const updated = await CompanyProfileRepository.updateProfile(updates);
        set({ profile: updated, isSaving: false });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('domexit_cached_company_profile', JSON.stringify(updated));
          } catch {
            // Ignore storage errors
          }
        }
        return updated;
      } catch (err: any) {
        set({ error: err.message || 'Ошибка сохранения профиля', isSaving: false });
        throw err;
      }
    },
  };
});
