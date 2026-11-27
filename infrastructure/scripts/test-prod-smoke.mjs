/**
 * infrastructure/scripts/test-prod-smoke.mjs
 * 12 Read-Only Production Smoke Tests on https://domexit.ru
 * Verifies core platform functionality, YDB v2 data endpoints,
 * and confirms that all AI Lab features are securely locked to owner_only / off.
 */

const BASE_URL = 'https://domexit.ru';

async function request(method, path, body = null, headers = {}) {
  const start = Date.now();
  const reqHeaders = { ...headers };
  if (body) {
    reqHeaders['Content-Type'] = 'application/json';
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: reqHeaders,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    return {
      status: res.status,
      body: text,
      headers: Object.fromEntries(res.headers.entries()),
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 0,
      body: err.message,
      headers: {},
      latencyMs: Date.now() - start,
    };
  }
}

async function runAll() {
  console.log('=== DomExit v3.0.0-ai-ready Production Smoke Tests ===');
  console.log('Target: ', BASE_URL);
  console.log('Time:   ', new Date().toISOString(), '\n');

  const tests = [
    {
      name: '1. Health Check (GET /api/health)',
      run: async () => {
        const res = await request('GET', '/api/health');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        const pass = res.status === 200 && json.ok === true && json.env === 'production' && json.region === 'ru-central1';
        return {
          pass,
          status: res.status,
          details: `ok=${json.ok}, env=${json.env}, region=${json.region}, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '2. Opportunities Lots Catalog (GET /api/data/lots)',
      run: async () => {
        const res = await request('GET', '/api/data/lots');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        const pass = res.status === 200 && Array.isArray(json.items);
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, isArray=${Array.isArray(json.items)}, itemsCount=${json.items?.length ?? 0}, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '3. Accredited Developers Parity (GET /api/data/developers)',
      run: async () => {
        const res = await request('GET', '/api/data/developers');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        const items = json.items || [];
        const hasDevTest = items.some(d => d.id === 'dev-test' || d.slug === 'dev-test');
        const pass = res.status === 200 && items.length === 15 && !hasDevTest;
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, developersCount=${items.length} (expected 15), testDevPresent=${hasDevTest}, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '4. Market Parameters (GET /api/data/market_settings)',
      run: async () => {
        const res = await request('GET', '/api/data/market_settings');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        const items = json.items || [];
        const paramItem = items.find(i => i.id === 'market_parameters');
        const pass = res.status === 200 && !!paramItem && typeof paramItem.cbrKeyRatePercent === 'number';
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, cbrKeyRate=${paramItem?.cbrKeyRatePercent}%, buyerCommission=${paramItem?.buyerCommissionPercent}%, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '5. AI Lab Secure Defaults Guard (GET /api/ai/config)',
      run: async () => {
        const res = await request('GET', '/api/ai/config');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        const eff = json.effectiveFeatures || {};
        const allLocked = Object.values(eff).every(v => v === false);
        const pass = res.status === 200 && json.masterLabEnabled === false && allLocked;
        return {
          pass,
          status: res.status,
          details: `masterLabEnabled=${json.masterLabEnabled}, all11FeaturesLocked=${allLocked}, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '6. Dynamic Sitemap XML (GET /sitemap.xml)',
      run: async () => {
        const res = await request('GET', '/sitemap.xml');
        const pass = res.status === 200 && (res.body.includes('<urlset') || res.body.includes('xmlns="http://www.sitemaps.org'));
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, isSitemapXml=${pass}, length=${res.body.length} bytes, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '7. Public Journal Gate Verification (GET /api/public/journal)',
      run: async () => {
        const res = await request('GET', '/api/public/journal');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        // Must return 403 JOURNAL_NOT_PUBLIC_YET because publicJournalSeo is locked to owner_only
        const pass = res.status === 403 && json.error === 'JOURNAL_NOT_PUBLIC_YET';
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, error=${json.error} (Gate active: ${pass}), latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '8. Public RSS Gate Verification (GET /api/public/rss.xml)',
      run: async () => {
        const res = await request('GET', '/api/public/rss.xml');
        let json = {};
        try { json = JSON.parse(res.body); } catch {}
        // Must return 403 JOURNAL_NOT_PUBLIC_YET because publicJournalSeo is locked
        const pass = res.status === 403 && json.error === 'JOURNAL_NOT_PUBLIC_YET';
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, error=${json.error} (Gate active: ${pass}), latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '9. AI Concierge Public Guard (POST /api/public/ai/concierge/chat)',
      run: async () => {
        const res = await request('POST', '/api/public/ai/concierge/chat', { message: 'Здравствуйте, есть ли студии в ПИК?' });
        // Must return 403 Forbidden because aiConciergeRag is locked to owner_only
        const pass = res.status === 403;
        return {
          pass,
          status: res.status,
          details: `status=${res.status} (Protected as expected: ${pass}), latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '10. External Agent Bridge Webhook Security (POST /api/public/ai/agent-bridge/webhook)',
      run: async () => {
        const res = await request('POST', '/api/public/ai/agent-bridge/webhook', { taskId: 'fake', result: {} });
        // Must return 403 Forbidden because agentResearchBridge is locked
        const pass = res.status === 403;
        return {
          pass,
          status: res.status,
          details: `status=${res.status} (Protected as expected: ${pass}), latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '11. Frontend Landing Page (GET /)',
      run: async () => {
        const res = await request('GET', '/');
        const pass = res.status === 200 && res.body.includes('<div id="root">') && res.body.includes('DomExit');
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, hasRoot=${res.body.includes('root')}, length=${res.body.length} bytes, latency=${res.latencyMs}ms`,
        };
      },
    },
    {
      name: '12. Frontend SPA Routing Fallback (GET /journal)',
      run: async () => {
        const res = await request('GET', '/journal');
        const pass = res.status === 200 && res.body.includes('<div id="root">');
        return {
          pass,
          status: res.status,
          details: `status=${res.status}, isSpaHtml=${pass}, length=${res.body.length} bytes, latency=${res.latencyMs}ms`,
        };
      },
    },
  ];

  let allPassed = true;
  const results = [];

  for (const test of tests) {
    const result = await test.run();
    results.push({ name: test.name, ...result });
    const mark = result.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} [${result.status}] ${test.name}: ${result.details}`);
    if (!result.pass) allPassed = false;
  }

  console.log('\n----------------------------------------');
  const passedCount = results.filter(r => r.pass).length;
  console.log(`Results: ${passedCount}/${tests.length} tests passed.`);
  if (!allPassed) {
    console.error('Smoke tests failed!');
    process.exit(1);
  } else {
    console.log('✓ All 12 Production Smoke Tests PASSED with 100% compliance!');
  }
}

runAll().catch(err => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
