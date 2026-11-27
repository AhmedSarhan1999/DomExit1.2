import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json } from '../lib/http.js';
import { getConfig } from '../lib/config.js';
import { getYdbClient } from '../lib/ydbClient.js';

export async function handleHealth(event: YcHttpEvent): Promise<YcHttpResponse> {
  const cfg = getConfig();
  const ydb = getYdbClient();
  return json(event, 200, {
    ok: true,
    env: cfg.APP_ENV,
    region: 'ru-central1',
    ydbV2Enabled: ydb.isV2TablesEnabled(),
    timestamp: new Date().toISOString(),
  });
}
