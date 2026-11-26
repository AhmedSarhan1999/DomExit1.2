/**
 * aiFeatureFlags.ts — PropTech AI Module
 * Manages feature flags for AI Lab capabilities.
 * Stored in platform_settings (id: 'ai_lab_config') in YDB.
 * Cache TTL: 60s, invalidated immediately on save.
 */

import { memoryCache } from '../../lib/memoryCache.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { logger } from '../../lib/logger.js';

export type AiFeatureKey =
  | 'dadataAutocomplete'
  | 'cbrAutoSync'
  | 'agentResearchBridge'
  | 'visionOcrPreAudit'
  | 'gptLegalCopilot'
  | 'avmValuation'
  | 'aiPackagingStudio'
  | 'legislativeRadar'
  | 'aiConciergeRag';

export type FeatureVisibility = 'off' | 'owner_only' | 'staff_only' | 'public';
export type UserRole = 'owner' | 'employee' | 'buyer' | 'guest';

export interface AiFeatureMeta {
  key: AiFeatureKey;
  labelRu: string;
  descriptionRu: string;
  implemented: boolean;
  roadmapStep?: string;
  defaultVisibility: FeatureVisibility;
}

export const AI_FEATURES_CATALOG: AiFeatureMeta[] = [
  {
    key: 'dadataAutocomplete',
    labelRu: 'Автодополнение адресов DaData',
    descriptionRu: 'Автодополнение российских адресов, проверка ИНН и поиск банков по БИК через DaData.ru (бесплатно, до 10 000 запросов/день)',
    implemented: true,
    defaultVisibility: 'owner_only',
  },
  {
    key: 'cbrAutoSync',
    labelRu: 'Автосинхронизация ставки ЦБ РФ',
    descriptionRu: 'Ежедневное автоматическое обновление ключевой ставки ЦБ РФ с официального сайта cbr.ru (бесплатно)',
    implemented: true,
    defaultVisibility: 'owner_only',
  },
  {
    key: 'agentResearchBridge',
    labelRu: 'Мост Агент-Исследователь',
    descriptionRu: 'AI-агент для анализа рынка недвижимости, парсинга цен застройщиков и сбора бенчмарков',
    implemented: true,
    roadmapStep: 'Этап 02',
    defaultVisibility: 'owner_only',
  },
  {
    key: 'visionOcrPreAudit',
    labelRu: 'Vision OCR Пре-аудит документов',
    descriptionRu: 'Автоматическое распознавание и предварительный аудит документов (ДДУ, выписки ЕГРН) с помощью Yandex Vision (152-ФЗ)',
    implemented: true,
    roadmapStep: 'Этап 03',
    defaultVisibility: 'owner_only',
  },
  {
    key: 'gptLegalCopilot',
    labelRu: 'GPT Юридический Копилот',
    descriptionRu: 'Интерактивный помощник для юридического анализа условий сделок и рисков по ДДУ',
    implemented: false,
    roadmapStep: 'Этап 04',
    defaultVisibility: 'off',
  },
  {
    key: 'avmValuation',
    labelRu: 'AVM Автоматическая оценка',
    descriptionRu: 'Автоматизированная рыночная оценка объектов недвижимости на основе AI-модели',
    implemented: false,
    roadmapStep: 'Этап 05',
    defaultVisibility: 'off',
  },
  {
    key: 'aiPackagingStudio',
    labelRu: 'AI Studio упаковки лотов',
    descriptionRu: 'Автоматическая генерация описаний и материалов для маркетинга объектов',
    implemented: false,
    roadmapStep: 'Этап 06',
    defaultVisibility: 'off',
  },
  {
    key: 'legislativeRadar',
    labelRu: 'Законодательный Радар',
    descriptionRu: 'Мониторинг изменений в законодательстве, влияющих на сделки с недвижимостью',
    implemented: false,
    roadmapStep: 'Этап 07',
    defaultVisibility: 'off',
  },
  {
    key: 'aiConciergeRag',
    labelRu: 'AI Консьерж (RAG)',
    descriptionRu: 'Интеллектуальный ассистент на основе базы знаний платформы для ответов на вопросы клиентов',
    implemented: false,
    roadmapStep: 'Этап 09',
    defaultVisibility: 'off',
  },
];

export interface AiLabConfig {
  id: 'ai_lab_config';
  masterLabEnabled: boolean;
  features: Record<AiFeatureKey, FeatureVisibility>;
  updatedAt: string;
  updatedBy?: string;
}

const AI_LAB_CACHE_KEY = 'ai_lab_config';
const AI_LAB_CACHE_TTL_SEC = 60;

function buildDefaultConfig(): AiLabConfig {
  const features = {} as Record<AiFeatureKey, FeatureVisibility>;
  for (const feat of AI_FEATURES_CATALOG) {
    features[feat.key] = feat.defaultVisibility;
  }
  return {
    id: 'ai_lab_config',
    masterLabEnabled: false,
    features,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Load AI Lab config from YDB (or return default if not yet initialized).
 * Uses 60s cache to reduce DB reads.
 */
export async function getAiLabConfig(): Promise<AiLabConfig> {
  const cached = memoryCache.get<AiLabConfig>(AI_LAB_CACHE_KEY);
  if (cached) return cached;

  try {
    const ydb = getYdbClient();
    const record = await ydb.getItem('platform_settings', 'ai_lab_config');
    if (record && record.config) {
      let parsed: AiLabConfig;
      try {
        parsed = typeof record.config === 'string' ? JSON.parse(record.config) : record.config;
      } catch {
        parsed = buildDefaultConfig();
      }
      // Merge with default to handle new feature keys
      const defaults = buildDefaultConfig();
      const merged: AiLabConfig = {
        ...defaults,
        ...parsed,
        features: { ...defaults.features, ...parsed.features },
      };
      memoryCache.set(AI_LAB_CACHE_KEY, merged, AI_LAB_CACHE_TTL_SEC);
      return merged;
    }
  } catch (err: any) {
    logger.warn('AI Lab config not found in YDB, using defaults', { meta: { error: err.message } });
  }

  const defaults = buildDefaultConfig();
  memoryCache.set(AI_LAB_CACHE_KEY, defaults, AI_LAB_CACHE_TTL_SEC);
  return defaults;
}

/**
 * Save AI Lab config to YDB and immediately invalidate cache.
 */
export async function saveAiLabConfig(config: AiLabConfig): Promise<void> {
  const ydb = getYdbClient();
  await ydb.putItem('platform_settings', {
    id: 'ai_lab_config',
    config: JSON.stringify(config),
    updatedAt: config.updatedAt,
  });
  memoryCache.invalidate(AI_LAB_CACHE_KEY);
}

/**
 * Invalidate the AI Lab config cache (call after any config change).
 */
export function invalidateAiLabCache(): void {
  memoryCache.invalidate(AI_LAB_CACHE_KEY);
}

/**
 * Determines if a user with the given role can use a specific AI feature.
 * Rules:
 *  - masterLabEnabled must be true
 *  - The feature must be implemented === true
 *  - Visibility must match the user's role:
 *    - 'off' → no one
 *    - 'owner_only' → owner only
 *    - 'staff_only' → owner + employee
 *    - 'public' → everyone (owner, employee, buyer, guest)
 */
export function canUseAiFeature(
  config: AiLabConfig,
  featureKey: AiFeatureKey,
  userRole: UserRole | undefined
): boolean {
  if (!config.masterLabEnabled) return false;

  const meta = AI_FEATURES_CATALOG.find((f) => f.key === featureKey);
  if (!meta || !meta.implemented) return false;

  const visibility = config.features[featureKey] ?? 'off';
  if (visibility === 'off') return false;
  if (visibility === 'owner_only') return userRole === 'owner';
  if (visibility === 'staff_only') return userRole === 'owner' || userRole === 'employee';
  if (visibility === 'public') return true;
  return false;
}

/**
 * Returns a safe map of feature → enabled (boolean) for the given user role.
 * Only includes implemented features.
 */
export function getEffectiveFeaturesForRole(
  config: AiLabConfig,
  userRole: UserRole | undefined
): Record<AiFeatureKey, boolean> {
  const result = {} as Record<AiFeatureKey, boolean>;
  for (const feat of AI_FEATURES_CATALOG) {
    result[feat.key] = feat.implemented
      ? canUseAiFeature(config, feat.key, userRole)
      : false;
  }
  return result;
}
