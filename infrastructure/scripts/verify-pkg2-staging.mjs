import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const BASE_URL = manifest.staging?.apiGatewayUrl || 'https://d5dpccovifu701p9lvga.bu9mdbe1.apigw.yandexcloud.net';

console.log('================================================================');
console.log('=== DOMEXIT EXECUTIVE PACKAGE 2 LIVE VERIFICATION SUITE ===');
console.log(`Target Staging URL: ${BASE_URL}`);
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    if (details) console.error(`    Details: ${details}`);
    failCount++;
  }
}

async function test1_Health() {
  console.log('\n--- 1. Testing Health Endpoint ---');
  const res = await fetch(`${BASE_URL}/api/health`);
  const data = await res.json();
  assert(res.status === 200, 'Health endpoint returns HTTP 200');
  assert(data.status === 'ok' || data.ok === true, 'Health payload status is ok');
}

async function test2_CursorPaginationAndCardProjection() {
  console.log('\n--- 2. Testing Cursor Pagination & Card Projection ---');
  // First page with fields=card
  const res1 = await fetch(`${BASE_URL}/api/data/lots?paginated=1&limit=12&fields=card`);
  const data1 = await res1.json();
  assert(res1.status === 200, 'Catalog paginated query returns HTTP 200');
  assert(Array.isArray(data1.items), 'Catalog returns items array');
  assert(typeof data1.hasMore === 'boolean', 'Catalog returns hasMore boolean flag');
  assert(typeof data1.totalMatching === 'number', 'Catalog returns totalMatching count');
  assert(typeof data1.stats === 'object' && data1.stats !== null, 'Catalog returns stats object');

  if (data1.items.length > 0) {
    const firstItem = data1.items[0];
    assert(Boolean(firstItem.id && firstItem.lotCode), 'Card item has essential identifiers (id, lotCode)');
    assert(firstItem.legalAuditAxes === undefined, 'Card item EXCLUDES legalAuditAxes (42 legal checkpoints)');
    assert(firstItem.curatorOperationsLog === undefined, 'Card item EXCLUDES curatorOperationsLog');
    assert(firstItem.internalNotes === undefined, 'Card item EXCLUDES internalNotes');
    assert(firstItem.submittedDocs === undefined, 'Card item EXCLUDES raw submittedDocs');

    const cardBytes = Buffer.byteLength(JSON.stringify(firstItem), 'utf-8');
    console.log(`    Lightweight projected card size: ${cardBytes} bytes (~${(cardBytes / 1024).toFixed(1)} KB)`);
    assert(cardBytes < 6000, 'Lightweight card size is under 6 KB');
  }

  // Next cursor test
  if (data1.hasMore && data1.nextCursor) {
    console.log(`    Testing nextCursor: ${data1.nextCursor.slice(0, 20)}...`);
    const res2 = await fetch(`${BASE_URL}/api/data/lots?paginated=1&limit=12&fields=card&cursor=${encodeURIComponent(data1.nextCursor)}`);
    const data2 = await res2.json();
    assert(res2.status === 200, 'Next cursor fetch returns HTTP 200');
    assert(Array.isArray(data2.items), 'Next cursor returns items array');
    if (data2.items.length > 0 && data1.items.length > 0) {
      assert(data2.items[0].id !== data1.items[0].id, 'Next page contains distinct lot items from page 1');
    }
  } else {
    console.log('    (Catalog has <= 12 items, skipping next cursor fetch test)');
  }
}

async function test3_BackwardCompatibility() {
  console.log('\n--- 3. Testing Backward Compatibility (Unpaginated Lots) ---');
  const res = await fetch(`${BASE_URL}/api/data/lots`);
  const data = await res.json();
  assert(res.status === 200, 'Unpaginated query returns HTTP 200');
  assert(Array.isArray(data.items), 'Unpaginated query returns { items: [...] } format');
  assert(data.items.length <= 100, `Unpaginated results capped at safe maximum 100 (got ${data.items.length})`);
}

async function test4_CacheHeadersAndETag() {
  console.log('\n--- 4. Testing Cache Headers, LRU Cache & ETag (304 Not Modified) ---');
  // Warm up containers
  await fetch(`${BASE_URL}/api/data/lots?paginated=1&limit=12&fields=card`);
  await fetch(`${BASE_URL}/api/data/lots?paginated=1&limit=12&fields=card`);

  const res1 = await fetch(`${BASE_URL}/api/data/lots?paginated=1&limit=12&fields=card`);
  const cacheControl = res1.headers.get('cache-control') || '';
  const etag = res1.headers.get('etag') || '';
  const xCache1 = res1.headers.get('x-cache') || '';

  assert(cacheControl.includes('public') && cacheControl.includes('max-age=30'), `Cache-Control is public, max-age=30 (got: "${cacheControl}")`);
  assert(Boolean(etag), `ETag is present on catalog response: ${etag}`);
  console.log(`    X-Cache on warmed request: ${xCache1}`);
  assert(xCache1 === 'HIT' || xCache1 === 'MISS', 'X-Cache header indicates cache operation (HIT or MISS)');

  // Request with If-None-Match: Should return HTTP 304 Not Modified
  if (etag) {
    const res3 = await fetch(`${BASE_URL}/api/data/lots?paginated=1&limit=12&fields=card`, {
      headers: {
        'If-None-Match': etag,
      },
    });
    assert(res3.status === 304, `Request with If-None-Match returns HTTP 304 Not Modified (got ${res3.status})`);
  }

  // Test developers collection caching
  const resDev = await fetch(`${BASE_URL}/api/data/developers`);
  const devCacheControl = resDev.headers.get('cache-control') || '';
  assert(devCacheControl.includes('public') && devCacheControl.includes('max-age=60'), `Developers Cache-Control is public, max-age=60 (got: "${devCacheControl}")`);
}

async function test5_RateLimiting() {
  console.log('\n--- 5. Testing Sliding Window Rate Limiting (HTTP 429 & X-RateLimit headers) ---');
  let hit429 = false;

  // Run up to 25 attempts to account for serverless multi-container instances
  for (let i = 1; i <= 25; i++) {
    const dummyAuth = {
      email: `ratelimit-probe-${Date.now()}-${i}@test.domexit.ru`,
      password: 'InvalidPassword123!',
    };

    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dummyAuth),
    });

    const limitHdr = res.headers.get('x-ratelimit-limit');
    const remainingHdr = res.headers.get('x-ratelimit-remaining');
    const retryAfterHdr = res.headers.get('retry-after');

    if (res.status === 429) {
      hit429 = true;
      const data = await res.json();
      console.log(`    ✓ 429 Triggered at attempt #${i}! Response error: "${data.error}"`);
      console.log(`    Headers: Limit=${limitHdr}, Remaining=${remainingHdr}, Retry-After=${retryAfterHdr}s`);
      assert(limitHdr === '10' || limitHdr === '5', `RateLimit-Limit header is present (got ${limitHdr})`);
      assert(Boolean(retryAfterHdr), 'Retry-After header is present on 429 response');
      assert(data.error.includes('Слишком много'), 'Error message is Russian and informative');
      break;
    }
  }

  assert(hit429, 'Rate limiting successfully enforced: triggered HTTP 429 after exceeding limit');
}

async function runAll() {
  try {
    await test1_Health();
    await test2_CursorPaginationAndCardProjection();
    await test3_BackwardCompatibility();
    await test4_CacheHeadersAndETag();
    await test5_RateLimiting();

    console.log('\n================================================================');
    console.log(`=== LIVE VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED ===`);
    console.log('================================================================\n');

    if (failCount > 0) {
      process.exit(1);
    } else {
      console.log('✓ All 5 Pillars verified and operational on Staging!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal verification error:', err);
    process.exit(1);
  }
}

runAll();
