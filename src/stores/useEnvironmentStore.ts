import { create } from 'zustand';

export type AppEnvironment = 'demo' | 'production';

interface EnvironmentState {
  currentEnv: AppEnvironment;
  isProduction: boolean;
  setEnvironment: (env: AppEnvironment) => void;
  toggleEnvironment: () => void;
}

const STORAGE_KEY = 'domexit_app_environment';

/**
 * Checks whether the active user stored in localStorage is an authorized platform owner.
 */
function isUserOwner(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('domexit_current_user_v3');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return (
      u?.role === 'owner' ||
      u?.activeRole === 'owner' ||
      u?.email === 'amaas9499@gmail.com'
    );
  } catch {
    return false;
  }
}

/**
 * Resolves initial environment:
 * 1. Default for all visitors, new sessions, and non-owner users is STRICTLY 'production'.
 * 2. 'demo' mode is permitted EXCLUSIVELY if the user is authenticated as an owner ('amaas9499@gmail.com' or role 'owner').
 */
function getInitialEnvironment(): AppEnvironment {
  if (typeof window !== 'undefined') {
    // If not owner, strictly enforce production
    if (!isUserOwner()) {
      try {
        localStorage.setItem(STORAGE_KEY, 'production');
      } catch {}
      return 'production';
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'demo' || stored === 'production') {
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  // Default strictly to 'production'
  return 'production';
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => {
  const initialEnv = getInitialEnvironment();

  return {
    currentEnv: initialEnv,
    isProduction: initialEnv === 'production',

    setEnvironment: (env: AppEnvironment) => {
      // Disallow demo mode for non-owners
      if (env === 'demo' && !isUserOwner()) {
        console.warn('[EnvironmentStore] Demo environment is restricted strictly to platform owners.');
        env = 'production';
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, env);
        } catch (e) {
          console.warn('[EnvironmentStore] Failed to persist env to localStorage:', e);
        }
      }

      set({
        currentEnv: env,
        isProduction: env === 'production',
      });

      // Dispatch global events for instant DAL reactivity across tabs and components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('domexit:environment_changed', { detail: { env } })
        );
        window.dispatchEvent(
          new CustomEvent('domexit:dal_updated', { detail: { collectionName: '*' } })
        );
      }
    },

    toggleEnvironment: () => {
      if (!isUserOwner()) {
        console.warn('[EnvironmentStore] Environment switching is restricted strictly to platform owners.');
        return;
      }
      const current = get().currentEnv;
      const nextEnv: AppEnvironment = current === 'production' ? 'demo' : 'production';
      get().setEnvironment(nextEnv);
    },
  };
});
