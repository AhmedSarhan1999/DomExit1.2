import { create } from 'zustand';
import { DatabaseGateway } from '../dal/DatabaseGateway';

export interface FeatureFlagsState {
  enableVipClub: boolean; // Default: false (MVP: direct 100% catalog access, VIP club gated until payment gateway)
  enableBankPortal: boolean; // Default: false (MVP: manual SBR escrow & curator in-branch processing)
  setFlag: (key: 'enableVipClub' | 'enableBankPortal', value: boolean) => void;
  toggleFlag: (key: 'enableVipClub' | 'enableBankPortal') => void;
}

const STORAGE_KEY = 'domexit_feature_flags';
const COLLECTION = 'platform_settings';
const DOC_ID = 'feature_flags';

interface StoredFlags {
  enableVipClub: boolean;
  enableBankPortal: boolean;
}

const DEFAULT_FLAGS: StoredFlags = {
  enableVipClub: false,
  enableBankPortal: false,
};

function getInitialFlags(): StoredFlags {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          enableVipClub: typeof parsed.enableVipClub === 'boolean' ? parsed.enableVipClub : DEFAULT_FLAGS.enableVipClub,
          enableBankPortal: typeof parsed.enableBankPortal === 'boolean' ? parsed.enableBankPortal : DEFAULT_FLAGS.enableBankPortal,
        };
      }
    } catch {
      // Fallback to default
    }
  }
  return DEFAULT_FLAGS;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set, get) => {
  const initial = getInitialFlags();

  // Subscribe to real-time changes if platform_settings changes in live DB
  if (typeof window !== 'undefined') {
    DatabaseGateway.subscribe((collection) => {
      if (collection === COLLECTION || !collection) {
        DatabaseGateway.getById<{ id: string; enableVipClub?: boolean; enableBankPortal?: boolean }>(
          COLLECTION,
          DOC_ID
        ).then((doc) => {
          if (doc) {
            const updated: StoredFlags = {
              enableVipClub: doc.enableVipClub ?? get().enableVipClub,
              enableBankPortal: doc.enableBankPortal ?? get().enableBankPortal,
            };
            set(updated);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch {
              // Ignore
            }
          }
        });
      }
    });
  }

  const persist = (next: StoredFlags) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      // Sync to DatabaseGateway asynchronously
      DatabaseGateway.save(COLLECTION, {
        id: DOC_ID,
        enableVipClub: next.enableVipClub,
        enableBankPortal: next.enableBankPortal,
        updatedAt: new Date().toISOString(),
      }).catch(() => {
        // Safe local persistence fallback
      });
    }
  };

  return {
    enableVipClub: initial.enableVipClub,
    enableBankPortal: initial.enableBankPortal,

    setFlag: (key: 'enableVipClub' | 'enableBankPortal', value: boolean) => {
      set((state) => {
        const next = {
          enableVipClub: key === 'enableVipClub' ? value : state.enableVipClub,
          enableBankPortal: key === 'enableBankPortal' ? value : state.enableBankPortal,
        };
        persist(next);
        return next;
      });
    },

    toggleFlag: (key: 'enableVipClub' | 'enableBankPortal') => {
      set((state) => {
        const next = {
          enableVipClub: key === 'enableVipClub' ? !state.enableVipClub : state.enableVipClub,
          enableBankPortal: key === 'enableBankPortal' ? !state.enableBankPortal : state.enableBankPortal,
        };
        persist(next);
        return next;
      });
    },
  };
});
