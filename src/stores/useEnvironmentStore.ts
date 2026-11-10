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
 * Resolves initial environment:
 * 1. Read from localStorage ('domexit_app_environment').
 * 2. If not specified: default to 'demo' in local development (Vite import.meta.env.DEV),
 *    and 'production' in production builds.
 */
function getInitialEnvironment(): AppEnvironment {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'demo' || stored === 'production') {
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  // Default: 'demo' in dev / sandbox, 'production' in live builds
  return import.meta.env.DEV ? 'demo' : 'production';
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => {
  const initialEnv = getInitialEnvironment();

  return {
    currentEnv: initialEnv,
    isProduction: initialEnv === 'production',

    setEnvironment: (env: AppEnvironment) => {
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
      const current = get().currentEnv;
      const nextEnv: AppEnvironment = current === 'production' ? 'demo' : 'production';
      get().setEnvironment(nextEnv);
    },
  };
});
