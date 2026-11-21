import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const STAGING_URL = manifest.staging.apiGatewayUrl;

console.log('=== Verifying Staging Web & API Endpoints ===');
console.log('Target Gateway:', STAGING_URL);

const tests = [
  { path: '/', expected: 200, type: 'html' },
  { path: '/opportunities', expected: 200, type: 'spa-fallback' },
  { path: '/sellers', expected: 200, type: 'spa-fallback' },
  { path: '/portal', expected: 200, type: 'spa-fallback' },
  { path: '/admin/dashboard', expected: 200, type: 'spa-fallback' },
  { path: '/admin/closing', expected: 200, type: 'spa-fallback' },
  { path: '/admin/legal-audit', expected: 200, type: 'spa-fallback' },
  { path: '/vip-catalog', expected: 200, type: 'decommissioned-no-redirect-loop' },
  { path: '/bank-portal', expected: 200, type: 'decommissioned-no-redirect-loop' },
  { path: '/api/health', expected: 200, type: 'api-health' },
  { path: '/api/auth/yandex/start', expected: 302, type: 'oauth-redirect' },
  { path: '/assets/index-DWXejt4r.css', expected: 200, type: 'asset-css' },
];

async function verify() {
  let allPassed = true;

  for (const t of tests) {
    const url = `${STAGING_URL}${t.path}`;
    try {
      const res = await fetch(url, { redirect: 'manual' });
      const status = res.status;
      const text = await res.text();
      const location = res.headers.get('location');

      let ok = status === t.expected;
      let notes = '';

      if (t.type === 'html' || t.type === 'spa-fallback') {
        const hasRoot = text.includes('id="root"');
        const hasTitle = text.includes('DomExit');
        if (!hasRoot || !hasTitle) ok = false;
        notes = `[HTML ${text.length} B, has #root: ${hasRoot}, title: ${hasTitle}]`;
      } else if (t.type === 'api-health') {
        const json = JSON.parse(text);
        if (!json.ok || json.env !== 'staging') ok = false;
        notes = `[JSON ok: ${json.ok}, env: ${json.env}]`;
      } else if (t.type === 'oauth-redirect') {
        const isOAuth = location && location.includes('oauth.yandex.ru');
        if (!isOAuth) ok = false;
        notes = `[Redirect to: ${location?.slice(0, 40)}...]`;
      } else if (t.type === 'asset-css') {
        const isCss = text.includes('--') || text.includes('color');
        notes = `[CSS ${text.length} B, Content-Type: ${res.headers.get('content-type')}]`;
      }

      const mark = ok ? '✓ PASS' : '✗ FAIL';
      console.log(`${mark} ${t.path.padEnd(30)} Status: ${status} ${notes}`);
      if (!ok) allPassed = false;
    } catch (err) {
      console.error(`✗ FAIL ${t.path.padEnd(30)} Error:`, err.message);
      allPassed = false;
    }
  }

  console.log(`\n=== Overall Verification: ${allPassed ? 'ALL TESTS PASSED 100%' : 'SOME TESTS FAILED'} ===`);
  if (!allPassed) process.exit(1);
}

verify();
