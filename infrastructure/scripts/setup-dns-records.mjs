import { execFileSync } from 'node:child_process';

const records = [
  '_acme-challenge.domexit.ru. 300 CNAME fpqivftt1kmksg779uab.cm.yandexcloud.net.',
  '_acme-challenge.www.domexit.ru. 300 CNAME fpqivftt1kmksg779uab.cm.yandexcloud.net.',
  'domexit.ru. 300 TXT "v=spf1 include:_spf.postbox.cloud.yandex.net ~all"',
  '_dmarc.domexit.ru. 300 TXT "v=DMARC1; p=quarantine; rua=mailto:postmaster@domexit.ru"',
];

console.log('=== Adding DNS Records to domexit-ru-zone ===');
for (const rec of records) {
  try {
    execFileSync('yc', ['dns', 'zone', 'add-records', '--name', 'domexit-ru-zone', '--record', rec], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
    console.log('  ✓ Added:', rec);
  } catch (err) {
    console.error('  ✗ Error adding:', rec, err.stderr ? err.stderr.toString() : err.message);
  }
}
