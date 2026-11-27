/**
 * useAiFeatureFlags.ts
 * Client-side hook for AI Lab feature flag management.
 * Caches config for 60s, invalidates on save or session change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { clientCache } from '../services/clientCache';

export type AiFeatureKey =
  | 'dadataAutocomplete'
  | 'cbrAutoSync'
  | 'agentResearchBridge'
  | 'visionOcrPreAudit'
  | 'gptLegalCopilot'
  | 'avmValuation'
  | 'aiPackagingStudio'
  | 'legislativeRadar'
  | 'publicJournalSeo'
  | 'aiConciergeRag';

export interface AiLabPublicConfig {
  masterLabEnabled: boolean;
  effectiveFeatures: Record<AiFeatureKey, boolean>;
}

export interface AiLabOwnerConfig extends AiLabPublicConfig {
  config: any;
  catalog: any[];
  connectors: {
    dadata: { configured: boolean; dailyUsed: number; dailySoftCap: number; mode: string };
    cbr: { currentKeyRate: number | null; effectiveDate: string | null; lastUpdatedAt: string | null };
    yandexAi: { configured: boolean };
  };
}

const AI_LAB_CACHE_KEY = '/api/ai/config';
const AI_LAB_TTL_MS = 60_000;

export function useAiFeatureFlags() {
  const [config, setConfig] = useState<AiLabPublicConfig | AiLabOwnerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = force
        ? await apiClient.get<AiLabPublicConfig | AiLabOwnerConfig>(AI_LAB_CACHE_KEY, { skipCache: true })
        : await clientCache.getOrFetch<AiLabPublicConfig | AiLabOwnerConfig>(
            AI_LAB_CACHE_KEY,
            () => apiClient.get<AiLabPublicConfig | AiLabOwnerConfig>(AI_LAB_CACHE_KEY, { skipCache: true }),
            AI_LAB_TTL_MS
          );
      if (mountedRef.current) setConfig(data);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || 'Ошибка загрузки AI Lab конфигурации');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const isFeatureEnabled = useCallback(
    (key: AiFeatureKey): boolean => {
      if (!config) return false;
      return config.effectiveFeatures?.[key] === true;
    },
    [config]
  );

  const refresh = useCallback(() => {
    clientCache.invalidateByEndpoint(AI_LAB_CACHE_KEY);
    load(true);
  }, [load]);

  return { config, loading, error, isFeatureEnabled, refresh };
}
