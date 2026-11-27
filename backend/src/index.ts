import dns from 'node:dns';
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { YcHttpEvent, YcHttpResponse } from './types.js';
import { json, handleOptions } from './lib/http.js';
import { getConfig } from './lib/config.js';
import { logger } from './lib/logger.js';
import { handleHealth } from './routes/health.js';
import { handleAuth } from './routes/auth.js';
import { handleData } from './routes/data.js';
import { handleStorage } from './routes/storage.js';
import { handleAdmin } from './routes/admin.js';
import { handleTelegram } from './routes/telegram.js';
import { handleTools } from './routes/tools.js';
import { handlePep } from './routes/pep.js';
import { handleMatching } from './routes/matching.js';
import { handleMessenger } from './routes/messenger.js';
import { handleTierVerification } from './routes/tierVerification.js';
import { handleAiLab } from './routes/aiLab.js';
import { handlePublicJournal } from './routes/publicJournal.js';
import { handleLegalCoreV1 } from './routes/legalCoreV1.js';

export async function handler(event: YcHttpEvent): Promise<YcHttpResponse> {
  const startTime = Date.now();
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
  const requestId = event.requestContext?.requestId || event.headers?.['x-request-id'] || `req-${Date.now()}`;

  // Immediate CORS Preflight handling
  if (method === 'OPTIONS') {
    return handleOptions(event, cfg.PUBLIC_BASE_URL, cfg.APP_ENV, cfg.PROD_CUSTOM_DOMAIN);
  }

  let response: YcHttpResponse;

  try {
    // 1. Health Check
    if (path === '/api/health' || path === '/health') {
      response = await handleHealth(event);
    }
    // 2. Auth Routes (/api/auth/*)
    else if (path.startsWith('/api/auth')) {
      const subPath = path.substring('/api/auth'.length) || '/';
      response = await handleAuth(event, subPath);
    }
    // 3. Admin Routes (/api/admin/*)
    else if (path.startsWith('/api/admin')) {
      const subPath = path.substring('/api/admin'.length) || '/';
      response = await handleAdmin(event, subPath);
    }
    // 4. Storage Routes (/api/storage/*)
    else if (path.startsWith('/api/storage')) {
      const subPath = path.substring('/api/storage'.length) || '/';
      response = await handleStorage(event, subPath);
    }
    // 5. Cascade lot delete (/api/lots/:lotCode/cascade)
    else if (/^\/api\/lots\/[^/]+\/cascade$/.test(path)) {
      const subPath = path.substring('/api'.length);
      response = await handleData(event, subPath);
    }
    // 6. Telegram Engine & Webhooks (/api/telegram/*)
    else if (path.startsWith('/api/telegram')) {
      const subPath = path.substring('/api'.length);
      response = await handleTelegram(event, subPath);
    }
    // 6b. Messenger Multi-Provider Engine & Webhooks (/api/messenger/*)
    else if (path.startsWith('/api/messenger')) {
      const subPath = path.substring('/api/messenger'.length) || '/';
      response = await handleMessenger(event, subPath);
    }
    // 7. Tools & Registry Lookups (/api/tools/*)
    else if (path.startsWith('/api/tools')) {
      const subPath = path.substring('/api/tools'.length) || '/';
      response = await handleTools(event, subPath);
    }
    // 8. PEP Digital Signatures 63-FZ (/api/pep/*)
    else if (path.startsWith('/api/pep')) {
      const subPath = path.substring('/api/pep'.length) || '/';
      response = await handlePep(event, subPath);
    }
    // 9. Buy-Box & Matching Engine (/api/matching/*)
    else if (path.startsWith('/api/matching')) {
      const subPath = path.substring('/api/matching'.length) || '/';
      response = await handleMatching(event, subPath);
    }
    // 9b. Tier Verification & Governance (/api/tier-requests/*)
    else if (path.startsWith('/api/tier-requests')) {
      const subPath = path.substring('/api/tier-requests'.length) || '/';
      response = await handleTierVerification(event, subPath);
    }
    // 10b. AI Laboratory (/api/ai/*)
    else if (path.startsWith('/api/ai')) {
      const subPath = path.substring('/api/ai'.length) || '/';
      response = await handleAiLab(event, subPath);
    }
    // 10c. Public SEO & Journal (/api/public/* and /sitemap.xml)
    else if (path.startsWith('/api/public') || path === '/sitemap.xml') {
      const subPath = path.startsWith('/api/public')
        ? path.substring('/api/public'.length) || '/'
        : path;
      response = await handlePublicJournal(event, subPath);
    }
    // 10d. Legal Core v1 Independent Facade (/api/legal-core/v1/*)
    else if (path.startsWith('/api/legal-core/v1')) {
      const subPath = path.substring('/api/legal-core/v1'.length) || '/';
      response = await handleLegalCoreV1(event, subPath);
    }
    // 10. Data Gateway (/api/data/*)
    else if (path.startsWith('/api/data')) {
      const subPath = path.substring('/api'.length);
      response = await handleData(event, subPath);
    } else {
      response = json(event, 404, {
        error: 'Not Found',
        path,
        method,
      });
    }

    const durationMs = Date.now() - startTime;
    if (response.statusCode >= 500) {
      logger.error(`${method} ${path} -> ${response.statusCode}`, {
        method,
        path,
        statusCode: response.statusCode,
        durationMs,
        requestId,
      });
    } else if (response.statusCode >= 400) {
      logger.warn(`${method} ${path} -> ${response.statusCode}`, {
        method,
        path,
        statusCode: response.statusCode,
        durationMs,
        requestId,
      });
    } else {
      logger.info(`${method} ${path} -> ${response.statusCode}`, {
        event: 'HTTP_ACCESS',
        method,
        path,
        statusCode: response.statusCode,
        durationMs,
        requestId,
      });
    }

    return response;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error(`[UnhandledError] ${method} ${path}: ${err.message}`, {
      method,
      path,
      statusCode: 500,
      durationMs,
      requestId,
      meta: { error: err.message, stack: err.stack },
    });

    return json(event, 500, {
      error: 'Internal Server Error',
      message: cfg.APP_ENV === 'staging' ? err.message : 'Произошла непредвиденная ошибка на сервере',
    });
  }
}
