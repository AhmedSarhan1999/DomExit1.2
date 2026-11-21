import { getConfig } from './config.js';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const SENSITIVE_KEY_PATTERN = /(password|passwordhash|secret|token|cookie|authorization|accesskey|phone|sellerphone|email|selleremail|inn|sellerinn|passport|snils)/i;

const SENSITIVE_QUERY_PARAMS = ['code', 'token', 'state', 'email', 'phone', 'password', 'secret', 'access_token'];

export function redactUrlPath(urlPath: string): string {
  if (!urlPath || !urlPath.includes('?')) return urlPath;
  try {
    const [pathPart, queryPart] = urlPath.split('?');
    const params = new URLSearchParams(queryPart);
    for (const key of params.keys()) {
      for (const sensitive of SENSITIVE_QUERY_PARAMS) {
        if (key.toLowerCase().includes(sensitive)) {
          params.set(key, '[REDACTED]');
        }
      }
    }
    const q = params.toString();
    return q ? `${pathPart}?${q}` : pathPart;
  } catch {
    return urlPath.split('?')[0] + '?[REDACTED]';
  }
}

export function redactDeep(data: any, depth = 0): any {
  if (depth > 8) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactDeep(item, depth + 1));
  }

  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = redactDeep(val, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp?: string;
  env?: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userRole?: string;
  event?: string;
  meta?: Record<string, any>;
}

export function log(entry: LogEntry): void {
  const cfg = getConfig();
  const timestamp = entry.timestamp || new Date().toISOString();
  const env = entry.env || cfg.APP_ENV || 'staging';

  const cleanPath = entry.path ? redactUrlPath(entry.path) : undefined;
  const cleanMeta = entry.meta ? redactDeep(entry.meta) : undefined;

  const record: Record<string, any> = {
    level: entry.level,
    message: entry.message,
    timestamp,
    env,
  };

  if (entry.requestId) record.requestId = entry.requestId;
  if (entry.method) record.method = entry.method;
  if (cleanPath) record.path = cleanPath;
  if (entry.statusCode !== undefined) record.statusCode = entry.statusCode;
  if (entry.durationMs !== undefined) record.durationMs = entry.durationMs;
  if (entry.userRole) record.userRole = entry.userRole;
  if (entry.event) record.event = entry.event;
  if (cleanMeta && Object.keys(cleanMeta).length > 0) record.meta = cleanMeta;

  const line = JSON.stringify(record);

  if (entry.level === 'ERROR') {
    console.error(line);
  } else if (entry.level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields?: Partial<LogEntry>) =>
    log({ level: 'INFO', message, ...fields }),
  warn: (message: string, fields?: Partial<LogEntry>) =>
    log({ level: 'WARN', message, ...fields }),
  error: (message: string, fields?: Partial<LogEntry>) =>
    log({ level: 'ERROR', message, ...fields }),
};
