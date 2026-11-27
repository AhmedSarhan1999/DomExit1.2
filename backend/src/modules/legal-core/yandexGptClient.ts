/**
 * backend/src/modules/legal-core/yandexGptClient.ts
 *
 * Dedicated client for Yandex Cloud Foundation Models (YandexGPT Pro & Lite).
 * Compliance: 152-FZ - strictly connects to ru-central1 endpoints.
 * FinOps: Enforces model tiering, smart truncation, token limits, and daily caps.
 */

import { execSync } from 'node:child_process';
import { getConfig } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

export type GptModelTier = 'lite' | 'pro';

export interface GptUsageStats {
  inputTextTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostRub: number;
}

export interface CompleteJsonOptions<T> {
  tier: GptModelTier;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  overrideIamToken?: string;
  validator?: (data: any) => data is T;
}

export interface CompleteJsonResult<T> {
  ok: boolean;
  data: T;
  rawText: string;
  usage: GptUsageStats;
  modelUri: string;
}

// In-memory daily usage tracking
interface DailyGptTracker {
  date: string;
  callsCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostRub: number;
}

let dailyTracker: DailyGptTracker = {
  date: new Date().toISOString().slice(0, 10),
  callsCount: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalEstimatedCostRub: 0,
};

function getDailyTracker(): DailyGptTracker {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyTracker.date !== today) {
    dailyTracker = {
      date: today,
      callsCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCostRub: 0,
    };
  }
  return dailyTracker;
}

export function getGptUsageSummary() {
  const t = getDailyTracker();
  const cfg = getConfig();
  const dailyCap = cfg.DAILY_GPT_CALLS_CAP || 100;
  return {
    configured: Boolean(cfg.YC_FOLDER_ID),
    dailyCallsUsed: t.callsCount,
    dailyCallsCap: dailyCap,
    totalInputTokens: t.totalInputTokens,
    totalOutputTokens: t.totalOutputTokens,
    estimatedMonthCostRub: Number(t.totalEstimatedCostRub.toFixed(2)),
  };
}

let cachedCliToken: { token: string; expiresAt: number } | null = null;

/**
 * Resolves IAM token for Yandex Cloud AI APIs.
 */
export async function resolveIamToken(overrideToken?: string): Promise<string> {
  if (overrideToken && overrideToken.trim()) return overrideToken.trim();

  const cfg = getConfig();
  if (process.env.YC_AI_IAM_TOKEN) return process.env.YC_AI_IAM_TOKEN.trim();
  if (process.env.YC_IAM_TOKEN) return process.env.YC_IAM_TOKEN.trim();
  if (cfg.YC_AI_IAM_TOKEN) return cfg.YC_AI_IAM_TOKEN.trim();

  // 1. Try compute metadata (when running inside Yandex Cloud Functions / Compute)
  try {
    const metaRes = await fetch('http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(1500),
    });
    if (metaRes.ok) {
      const data = (await metaRes.json()) as any;
      if (data?.access_token) return data.access_token;
    }
  } catch {
    // Ignore metadata outside compute
  }

  // 2. Try yc CLI token (cached 10 min)
  if (cachedCliToken && Date.now() < cachedCliToken.expiresAt) {
    return cachedCliToken.token;
  }

  try {
    const token = execSync('yc iam create-token', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000,
    }).trim();
    if (token) {
      cachedCliToken = { token, expiresAt: Date.now() + 10 * 60 * 1000 };
      return token;
    }
  } catch {
    // CLI not available
  }

  throw new Error('YC_AI_IAM_TOKEN could not be resolved from environment, compute metadata, or yc CLI.');
}

function calculateCostRub(tier: GptModelTier, inputTokens: number, outputTokens: number): number {
  // Yandex Cloud official pricing (approx per 1,000 tokens):
  // Lite: input 0.20 ₽ / 1k, output 0.40 ₽ / 1k
  // Pro:  input 1.20 ₽ / 1k, output 1.20 ₽ / 1k
  if (tier === 'lite') {
    return (inputTokens / 1000) * 0.2 + (outputTokens / 1000) * 0.4;
  }
  return (inputTokens / 1000) * 1.2 + (outputTokens / 1000) * 1.2;
}

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  // Strip Markdown ```json ... ``` blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  cleaned = cleaned.trim();
  // If wrapped in quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      cleaned = JSON.parse(cleaned);
    } catch {
      // ignore
    }
  }
  return cleaned;
}

/**
 * Executes a structured JSON completion with YandexGPT.
 */
export async function completeJson<T>(options: CompleteJsonOptions<T>): Promise<CompleteJsonResult<T>> {
  const cfg = getConfig();
  const folderId = cfg.YC_FOLDER_ID || 'b1g46uad3gc3h34k5b0f';
  const dailyCap = cfg.DAILY_GPT_CALLS_CAP || 100;

  const tracker = getDailyTracker();
  if (tracker.callsCount >= dailyCap) {
    throw new Error(`Превышен суточный лимит обращений к YandexGPT (${dailyCap} запросов в день на Staging).`);
  }

  const modelName = options.tier === 'lite' ? 'yandexgpt-lite' : 'yandexgpt';
  const modelUri = `gpt://${folderId}/${modelName}/latest`;

  // FinOps Guardrail: enforce temperature and token ceilings
  const maxTokens =
    options.maxTokens || (options.tier === 'lite' ? 900 : 2200);
  const temperature =
    options.temperature !== undefined
      ? options.temperature
      : options.tier === 'lite'
      ? 0.05
      : 0.1;

  // Max characters guardrail (24k chars)
  const maxPromptLength = 24000;
  let userPrompt = options.userPrompt;
  if (userPrompt.length > maxPromptLength) {
    logger.warn('[YandexGPT] Truncating user prompt exceeding max length', {
      meta: { original: userPrompt.length, limit: maxPromptLength },
    });
    userPrompt = userPrompt.slice(0, maxPromptLength) + '\n\n[Текст обрезан для соблюдения лимитов контекста]';
  }

  const systemPrompt = `${options.systemPrompt.trim()}

ВАЖНО: Твой ответ должен быть СТРОГО валидным JSON-объектом без каких-либо вводных слов, пояснений, комментариев и Markdown-тегов (без \`\`\`json). Выводи только чистый JSON.`;

  const payload = {
    modelUri,
    completionOptions: {
      stream: false,
      temperature,
      maxTokens,
    },
    messages: [
      { role: 'system', text: systemPrompt },
      { role: 'user', text: userPrompt },
    ],
  };

  const endpoint = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  let lastError: Error | null = null;

  // Execute with up to 1 retry on JSON parsing failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    const iamToken = await resolveIamToken(options.overrideIamToken);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${iamToken}`,
      'x-folder-id': folderId,
    };

    logger.info('[YandexGPT] Dispatching completion request', {
      meta: { tier: options.tier, modelUri, attempt, promptLength: userPrompt.length },
    });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`YandexGPT API error (${res.status}): ${errText}`);
    }

    const resJson = (await res.json()) as any;
    const textOutput = resJson?.result?.alternatives?.[0]?.message?.text || '';
    const usageData = resJson?.result?.usage || {};
    const inputTokens = Number(usageData.inputTextTokens || 0);
    const outputTokens = Number(usageData.completionTokens || 0);
    const totalTokens = inputTokens + outputTokens;
    const costRub = calculateCostRub(options.tier, inputTokens, outputTokens);

    // Track usage
    tracker.callsCount += 1;
    tracker.totalInputTokens += inputTokens;
    tracker.totalOutputTokens += outputTokens;
    tracker.totalEstimatedCostRub += costRub;

    const cleanedText = cleanJsonString(textOutput);

    try {
      const parsed = JSON.parse(cleanedText);
      if (options.validator && !options.validator(parsed)) {
        throw new Error('JSON structure did not pass schema validator');
      }

      logger.info('[YandexGPT] Successfully received and parsed structured JSON', {
        meta: {
          tier: options.tier,
          inputTokens,
          outputTokens,
          costRub: Number(costRub.toFixed(4)),
        },
      });

      return {
        ok: true,
        data: parsed as T,
        rawText: textOutput,
        usage: {
          inputTextTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens,
          estimatedCostRub: Number(costRub.toFixed(4)),
        },
        modelUri,
      };
    } catch (parseErr: any) {
      lastError = parseErr;
      logger.warn('[YandexGPT] Failed to parse JSON response on attempt', {
        meta: { attempt, error: parseErr.message, preview: cleanedText.slice(0, 200) },
      });
      // On retry, nudge user message to be strictly raw JSON
      if (attempt < 2) {
        payload.messages.push({ role: 'assistant', text: textOutput });
        payload.messages.push({
          role: 'user',
          text: 'Ошибка парсинга JSON. Пожалуйста, исправь ошибки и выведи ТОЛЬКО валидный JSON без дополнительного текста.',
        });
      }
    }
  }

  throw new Error(`Не удалось получить корректный JSON от YandexGPT после 2 попыток: ${lastError?.message}`);
}

export const yandexGptClient = {
  completeJson,
  getGptUsageSummary,
  resolveIamToken,
};
