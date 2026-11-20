import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json } from '../lib/http.js';
import { getConfig } from '../lib/config.js';

export async function handleHealth(event: YcHttpEvent): Promise<YcHttpResponse> {
  const cfg = getConfig();
  return json(event, 200, {
    ok: true,
    env: cfg.APP_ENV,
    region: 'ru-central1',
    timestamp: new Date().toISOString(),
  });
}
