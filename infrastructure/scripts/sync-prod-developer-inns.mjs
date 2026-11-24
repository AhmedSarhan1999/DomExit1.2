import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'infrastructure/cloud-manifest.json');
const ENV_PATH = path.join(ROOT_DIR, '.env.cloud.local');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [k, ...vParts] = trimmed.split('=');
  envVars[k] = vParts.join('=');
}

const ydbEndpoint = manifest.production?.ydbDocApiEndpoint;
const accessKeyId = envVars.YC_ACCESS_KEY_ID || envVars.AWS_ACCESS_KEY_ID;
const secretAccessKey = envVars.YC_SECRET_ACCESS_KEY || envVars.AWS_SECRET_ACCESS_KEY;

if (!ydbEndpoint || !accessKeyId || !secretAccessKey) {
  console.error('Missing YDB endpoint or credentials for Production!');
  process.exit(1);
}

function toDynamo(val) {
  if (val === null || val === undefined) return { NULL: true };
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map(toDynamo) };
  if (typeof val === 'object') {
    const m = {};
    for (const k of Object.keys(val)) {
      if (val[k] !== undefined) m[k] = toDynamo(val[k]);
    }
    return { M: m };
  }
  return { S: String(val) };
}

function fromDynamo(attr) {
  if (!attr) return null;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr && Array.isArray(attr.L)) return attr.L.map(fromDynamo);
  if ('M' in attr && typeof attr.M === 'object') {
    const obj = {};
    for (const k of Object.keys(attr.M)) {
      obj[k] = fromDynamo(attr.M[k]);
    }
    return obj;
  }
  return null;
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

async function callYdb(target, body) {
  const url = new URL(ydbEndpoint);
  const host = url.host;
  const reqPath = url.pathname || '/';
  const region = 'ru-central1';
  const service = 'dynamodb';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const payload = JSON.stringify(body);
  const targetHeader = `DynamoDB_20120810.${target}`;
  const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${targetHeader}\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = `POST\n${reqPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(payload)}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${sha256Hex(canonicalRequest)}`;
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(ydbEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': targetHeader,
      'X-Amz-Date': amzDate,
      Authorization: auth,
    },
    body: payload,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, ok: res.ok, body: json };
}

// Target verified developers and correct 10-digit INNs
const TOP_DEVELOPERS = [
  { id: 'dev-pik', name: 'ПИК', inn: '7713011336' },
  { id: 'dev-samolet', name: 'Самолёт', inn: '9731004688' },
  { id: 'dev-lsr', name: 'ЛСР', inn: '7838360491' },
  { id: 'dev-setl-group', name: 'Сетл Групп', inn: '7810245481' },
  { id: 'dev-fsk', name: 'ФСК', inn: '7704569100' },
  { id: 'dev-etalon', name: 'Эталон', inn: '7814116230' },
  { id: 'dev-a101', name: 'А101', inn: '7704810149' },
  { id: 'dev-brusnika', name: 'Брусника', inn: '6671382990' },
  { id: 'dev-glavstroy', name: 'Главстрой', inn: '7839347260' },
  { id: 'dev-rbi', name: 'RBI', inn: '7825431804' },
  { id: 'dev-kvs', name: 'КВС', inn: '7802374518' },
  { id: 'dev-pioneer', name: 'ГК Пионер', inn: '7703635416' },
  { id: 'dev-mr-group', name: 'МР Групп', inn: '7703512904' },
  { id: 'dev-sminex', name: 'Sminex', inn: '7705886616' },
  { id: 'dev-donstroy', name: 'Донстрой', inn: '7709298340' },
];

async function main() {
  console.log('=== Checking Accredited Developers in Production Database ===');
  console.log(`Endpoint: ${ydbEndpoint}`);

  const scanRes = await callYdb('Scan', { TableName: 'developers' });
  if (!scanRes.ok) {
    console.error('Failed to scan developers table:', scanRes.status, scanRes.body);
    process.exit(1);
  }

  const rawItems = scanRes.body.Items || [];
  console.log(`Found ${rawItems.length} developer records in Production database:`);
  const existingMap = new Map();
  for (const raw of rawItems) {
    const item = {};
    for (const [k, v] of Object.entries(raw)) {
      item[k] = fromDynamo(v);
    }
    console.log(`- Developer ID: ${item.id}, Name: ${item.name}, INN: ${item.inn}`);
    existingMap.set(item.id, item);
    if (item.name) existingMap.set(item.name.toLowerCase(), item);
  }

  let updatedCount = 0;
  for (const dev of TOP_DEVELOPERS) {
    const existing = existingMap.get(dev.id) || existingMap.get(dev.name.toLowerCase());
    if (existing) {
      if (existing.inn !== dev.inn) {
        console.log(`Updating ${dev.name} (${dev.id}): Old INN=${existing.inn} -> New INN=${dev.inn}`);
        existing.inn = dev.inn;
        existing.updatedAt = new Date().toISOString();

        const dynamoItem = {};
        for (const [k, v] of Object.entries(existing)) {
          dynamoItem[k] = toDynamo(v);
        }

        const putRes = await callYdb('PutItem', {
          TableName: 'developers',
          Item: dynamoItem,
        });

        if (putRes.ok) {
          console.log(`  ✓ Updated successfully: ${dev.name}`);
          updatedCount++;
        }
      } else {
        console.log(`✓ ${dev.name} already has correct INN: ${existing.inn}`);
      }
    } else {
      console.log(`Seeding accredited developer into Production: ${dev.name} (${dev.inn})`);
      const newDev = {
        id: dev.id,
        name: dev.name,
        inn: dev.inn,
        isAccredited: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const dynamoItem = {};
      for (const [k, v] of Object.entries(newDev)) {
        dynamoItem[k] = toDynamo(v);
      }

      const putRes = await callYdb('PutItem', {
        TableName: 'developers',
        Item: dynamoItem,
      });

      if (putRes.ok) {
        console.log(`  ✓ Seeded successfully: ${dev.name}`);
        updatedCount++;
      }
    }
  }

  console.log(`\n=== Developer INN Sync Complete: ${updatedCount} records updated/seeded ===`);
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
