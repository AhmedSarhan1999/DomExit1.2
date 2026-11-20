import { YcHttpEvent, YcHttpResponse } from './types.js';
import { json, handleOptions } from './lib/http.js';
import { getConfig } from './lib/config.js';
import { handleHealth } from './routes/health.js';
import { handleAuth } from './routes/auth.js';
import { handleData } from './routes/data.js';
import { handleStorage } from './routes/storage.js';

export async function handler(event: YcHttpEvent): Promise<YcHttpResponse> {
  const cfg = getConfig();

  // Normalize path
  let path = event.path || event.url || '';
  if (path.includes('{proxy+}') || path.includes('{') || !path) {
    if (event.params?.proxy) {
      path = `/api/${event.params.proxy}`;
    } else if (event.url) {
      path = event.url;
    }
  }
  // Strip query string if present in path
  if (path.includes('?')) {
    path = path.split('?')[0];
  }

  const method = (event.httpMethod || 'GET').toUpperCase();

  // Immediate CORS Preflight handling
  if (method === 'OPTIONS') {
    return handleOptions(event, cfg.PUBLIC_BASE_URL);
  }

  try {
    // 1. Health Check
    if (path === '/api/health' || path === '/health') {
      return await handleHealth(event);
    }

    // 2. Auth Routes (/api/auth/*)
    if (path.startsWith('/api/auth')) {
      const subPath = path.substring('/api/auth'.length) || '/';
      return await handleAuth(event, subPath);
    }

    // 3. Storage Routes (/api/storage/*)
    if (path.startsWith('/api/storage')) {
      const subPath = path.substring('/api/storage'.length) || '/';
      return await handleStorage(event, subPath);
    }

    // 4. Cascade lot delete (/api/lots/:lotCode/cascade)
    if (/^\/api\/lots\/[^/]+\/cascade$/.test(path)) {
      const subPath = path.substring('/api'.length);
      return await handleData(event, subPath);
    }

    // 5. Data Gateway (/api/data/*)
    if (path.startsWith('/api/data')) {
      const subPath = path.substring('/api'.length);
      return await handleData(event, subPath);
    }

    return json(event, 404, {
      error: 'Not Found',
      path,
      method,
    });
  } catch (err: any) {
    console.error(`[UnhandledError] ${method} ${path}:`, err);
    return json(event, 500, {
      error: 'Internal Server Error',
      message: cfg.APP_ENV === 'staging' ? err.message : 'Произошла непредвиденная ошибка на сервере',
    });
  }
}
