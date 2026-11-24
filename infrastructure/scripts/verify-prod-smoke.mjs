import https from 'node:https';

function request(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: false,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('=== Production Live Verification (https://domexit.ru) ===\n');
  const results = [];

  // 1. Root HTML
  console.log('1. Checking Root Homepage (https://domexit.ru)...');
  const root = await request('https://domexit.ru/');
  const rootBodyLower = root.body.toLowerCase();
  const rootOk = root.statusCode === 200 && rootBodyLower.includes('<!doctype html>') && rootBodyLower.includes('domexit');
  results.push({
    test: 'Homepage (/)',
    status: root.statusCode,
    cacheControl: root.headers['cache-control'],
    passed: rootOk,
  });
  console.log(`   Status: ${root.statusCode}, Cache-Control: ${root.headers['cache-control']}, Passed: ${rootOk}`);

  // 2. SPA Route (/portal)
  console.log('\n2. Checking SPA Fallback (/portal)...');
  const portal = await request('https://domexit.ru/portal');
  const portalBodyLower = portal.body.toLowerCase();
  const portalOk = portal.statusCode === 200 && portalBodyLower.includes('<!doctype html>') && portalBodyLower.includes('domexit');
  results.push({
    test: 'SPA Fallback (/portal)',
    status: portal.statusCode,
    cacheControl: portal.headers['cache-control'],
    passed: portalOk,
  });
  console.log(`   Status: ${portal.statusCode}, Passed: ${portalOk}`);

  // 3. Yandex Webmaster Verification File
  console.log('\n3. Checking Yandex Verification File (yandex_863365d0efe2c1c8.html)...');
  const ym = await request('https://domexit.ru/yandex_863365d0efe2c1c8.html');
  const ymOk = ym.statusCode === 200 && ym.body.includes('863365d0efe2c1c8');
  results.push({
    test: 'Yandex Webmaster HTML',
    status: ym.statusCode,
    passed: ymOk,
  });
  console.log(`   Status: ${ym.statusCode}, Passed: ${ymOk}`);

  // 4. API Health Check
  console.log('\n4. Checking Production API Health (/api/health)...');
  const health = await request('https://domexit.ru/api/health');
  let healthJson = {};
  try { healthJson = JSON.parse(health.body); } catch {}
  const healthOk = health.statusCode === 200 && (healthJson.ok === true || healthJson.status === 'ok');
  results.push({
    test: 'API Health (/api/health)',
    status: health.statusCode,
    response: healthJson,
    passed: healthOk,
  });
  console.log(`   Status: ${health.statusCode}, Response: ${JSON.stringify(healthJson)}, Passed: ${healthOk}`);

  // 5. Yandex OAuth Start Redirect
  console.log('\n5. Checking Yandex OAuth Start Endpoint (/api/auth/yandex/start)...');
  const oauth = await request('https://domexit.ru/api/auth/yandex/start');
  const loc = oauth.headers['location'] || '';
  const expectedRedirect = 'redirect_uri=https%3A%2F%2Fdomexit.ru%2Fapi%2Fauth%2Fyandex%2Fcallback';
  const oauthOk = oauth.statusCode === 302 && loc.includes(expectedRedirect);
  results.push({
    test: 'Yandex OAuth URL',
    status: oauth.statusCode,
    location: loc.substring(0, 100) + '...',
    passed: oauthOk,
  });
  console.log(`   Status: ${oauth.statusCode}, Correct Callback: ${loc.includes(expectedRedirect)}, Passed: ${oauthOk}`);

  // 6. Lots API (Pagination, Fields=card, ETag, Cache-Control)
  console.log('\n6. Checking Lots API with Cursor Pagination & Cards (/api/data/lots?paginated=1&limit=12&fields=card)...');
  const lots = await request('https://domexit.ru/api/data/lots?paginated=1&limit=12&fields=card');
  let lotsJson = {};
  try { lotsJson = JSON.parse(lots.body); } catch {}
  const items = Array.isArray(lotsJson) ? lotsJson : (lotsJson.items || []);
  const sample = items[0] || {};
  const hasNoHeavyAudit = sample.legalAuditAxes === undefined;
  const etag = lots.headers['etag'];
  const lotsOk = lots.statusCode === 200 && Array.isArray(items) && hasNoHeavyAudit && !!etag;

  results.push({
    test: 'Lots API (Cards + Pagination + ETag)',
    status: lots.statusCode,
    itemsCount: items.length,
    hasNoHeavyAudit,
    etag: !!etag,
    passed: lotsOk,
  });
  console.log(`   Status: ${lots.statusCode}, Items Count: ${items.length}, Card Optimization (No heavy audit): ${hasNoHeavyAudit}`);
  console.log(`   ETag: ${etag}, Passed: ${lotsOk}`);

  // 7. Conditional GET with ETag (304 Not Modified)
  if (etag) {
    console.log('\n7. Checking HTTP 304 Not Modified with If-None-Match...');
    const cond = await request('https://domexit.ru/api/data/lots?paginated=1&limit=12&fields=card', {
      headers: { 'if-none-match': etag },
    });
    const condOk = cond.statusCode === 304;
    results.push({
      test: 'Conditional GET (304 Not Modified)',
      status: cond.statusCode,
      passed: condOk,
    });
    console.log(`   Status: ${cond.statusCode}, Passed: ${condOk}`);
  }

  // 8. Rate Limiting Headers on Protected Endpoints
  console.log('\n8. Checking Sliding Window Rate Limiting Headers (/api/auth/login)...');
  const authProbe = await request('https://domexit.ru/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const rlLimit = authProbe.headers['x-ratelimit-limit'];
  const rlRemaining = authProbe.headers['x-ratelimit-remaining'];
  const rlReset = authProbe.headers['x-ratelimit-reset'];
  const rlOk = authProbe.statusCode === 400 && !!rlLimit && rlRemaining !== undefined;
  results.push({
    test: 'Sliding Window Rate Limit Headers',
    status: authProbe.statusCode,
    rateLimitLimit: rlLimit,
    rateLimitRemaining: rlRemaining,
    rateLimitReset: rlReset,
    passed: rlOk,
  });
  console.log(`   Status: ${authProbe.statusCode}, Limit: ${rlLimit}, Remaining: ${rlRemaining}, Reset: ${rlReset}, Passed: ${rlOk}`);

  // 9. Developers API (Verifying Accredited Developers and 10-digit INNs)
  console.log('\n9. Checking Developers API (/api/data/developers)...');
  const devs = await request('https://domexit.ru/api/data/developers');
  let devsJson = [];
  try { devsJson = JSON.parse(devs.body); } catch {}
  const devList = Array.isArray(devsJson) ? devsJson : (devsJson.items || []);
  const pik = devList.find(d => d.name && d.name.includes('ПИК'));
  const pikInn = pik ? pik.inn : null;
  const devsOk = devs.statusCode === 200 && devList.length >= 10 && pikInn === '7713011336';
  results.push({
    test: 'Developers API & 10-digit INN',
    status: devs.statusCode,
    totalDevelopers: devList.length,
    pikInn,
    passed: devsOk,
  });
  console.log(`   Status: ${devs.statusCode}, Developers Count: ${devList.length}, ПИК INN: ${pikInn}, Passed: ${devsOk}`);

  // 10. Static Assets Cache-Control (Immutable)
  console.log('\n10. Checking Static Assets Cache-Control Header...');
  const assetCheck = await request('https://domexit.ru/assets/index-Dde0yWEZ.css');
  const assetCc = assetCheck.headers['cache-control'] || '';
  const assetOk = assetCheck.statusCode === 200 && assetCc.includes('immutable');
  results.push({
    test: 'Static Asset Cache-Control (immutable)',
    status: assetCheck.statusCode,
    cacheControl: assetCc,
    passed: assetOk,
  });
  console.log(`   Status: ${assetCheck.statusCode}, Cache-Control: ${assetCc}, Passed: ${assetOk}`);

  console.log('\n=== Summary of Production Smoke Tests ===');
  console.table(results);

  const allPassed = results.every(r => r.passed);
  if (allPassed) {
    console.log('\n>>> ALL 10 PRODUCTION SMOKE TESTS PASSED PERFECTLY! <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED! CHECK TABLE ABOVE <<<');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Smoke tests failed with error:', err);
  process.exit(1);
});
