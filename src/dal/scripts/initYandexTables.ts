import { UserProfile, MarketSettings } from '../../types';

export const YANDEX_REQUIRED_TABLES = [
  // Clean Production Collections
  'users',
  'employees',
  'developers',
  'developer_accreditation_requests',
  'market_settings',
  'lots',
  'deals',
  'seller_requests',
  'buyer_applications',
  'candidates',
  'documents_vault',
  'audit_logs',
  'partners',
  'partner_applications',
  'user_consents',
  'investor_applications',
  'partner_banks',
  'bank_employees',
  'bank_special_approvals',
  'escrow_bridge_chats',
  'partner_preliminary_requests',
  // Isolated Demo / Sandbox Collections
  'demo_users',
  'demo_employees',
  'demo_lots',
  'demo_deals',
  'demo_seller_requests',
  'demo_buyer_applications',
  'demo_candidates',
  'demo_documents_vault',
  'demo_developers',
  'demo_developer_accreditation_requests',
  'demo_partners',
  'demo_partner_applications',
  'demo_audit_logs',
  'demo_user_consents',
  'demo_investor_applications',
  'demo_partner_banks',
  'demo_bank_employees',
  'demo_bank_special_approvals',
  'demo_escrow_bridge_chats',
  'demo_partner_preliminary_requests',
] as const;

export interface YandexCredentialsConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  storageBucket: string;
  storageEndpoint: string;
}

export function getYandexCredentials(): YandexCredentialsConfig {
  return {
    endpoint:
      import.meta.env.VITE_YANDEX_YDB_DOCAPI_ENDPOINT ||
      'https://docapi.serverless.yandexcloud.net/ru-central1/b1gbu0q3jqnheri2srsu/etnckg937628mnid7tnb',
    region: import.meta.env.VITE_YANDEX_REGION || 'ru-central1',
    accessKeyId: import.meta.env.VITE_YANDEX_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_YANDEX_SECRET_ACCESS_KEY || '',
    storageBucket: import.meta.env.VITE_YANDEX_STORAGE_BUCKET || 'domexit-storage-vault',
    storageEndpoint: import.meta.env.VITE_YANDEX_STORAGE_ENDPOINT || 'https://storage.yandexcloud.net',
  };
}

async function sha256Hex(str: string | Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const buf = typeof str === 'string' ? enc.encode(str) : str;
  const data: BufferSource = buf instanceof Uint8Array ? (buf as unknown as BufferSource) : buf;
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacRaw(keyBuf: ArrayBuffer | Uint8Array, dataBuf: Uint8Array): Promise<ArrayBuffer> {
  const keyData: BufferSource = keyBuf instanceof Uint8Array ? (keyBuf as unknown as BufferSource) : keyBuf;
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await globalThis.crypto.subtle.sign('HMAC', key, dataBuf as unknown as BufferSource);
}

async function getSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const kDate = await hmacRaw(enc.encode('AWS4' + secret), enc.encode(dateStamp));
  const kRegion = await hmacRaw(kDate, enc.encode(region));
  const kService = await hmacRaw(kRegion, enc.encode(service));
  return await hmacRaw(kService, enc.encode('aws4_request'));
}

export async function callYdbDocApi(
  target: string,
  bodyObj: Record<string, any>,
  config?: YandexCredentialsConfig
): Promise<{ status: number; text: string; data?: any }> {
  const cfg = config || getYandexCredentials();
  const url = new URL(cfg.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const body = JSON.stringify(bodyObj);
  const bodyHash = await sha256Hex(body);

  const canonicalHeaders = [
    'content-type:application/x-amz-json-1.0',
    `host:${url.host}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`,
  ].join('\n') + '\n';

  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
  const canonicalRequest = [
    'POST',
    url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${cfg.region}/dynamodb/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(cfg.secretAccessKey, dateStamp, cfg.region, 'dynamodb');
  const enc = new TextEncoder();
  const sigBuf = await hmacRaw(signingKey, enc.encode(stringToSign));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': target,
      'X-Amz-Date': amzDate,
      Authorization: authHeader,
    },
    body,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: res.status, text, data };
}

export function toDynamoAttribute(val: any): any {
  if (val === null || val === undefined) return { NULL: true };
  if (typeof val === 'string') return { S: val };
  if (typeof val === 'number') return { N: String(val) };
  if (typeof val === 'boolean') return { BOOL: val };
  if (Array.isArray(val)) return { L: val.map(toDynamoAttribute) };
  if (typeof val === 'object') {
    const m: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      if (val[k] !== undefined) m[k] = toDynamoAttribute(val[k]);
    }
    return { M: m };
  }
  return { S: String(val) };
}

export function fromDynamoAttribute(attr: any): any {
  if (!attr) return null;
  if ('S' in attr) return attr.S;
  if ('N' in attr) return Number(attr.N);
  if ('BOOL' in attr) return attr.BOOL;
  if ('NULL' in attr) return null;
  if ('L' in attr && Array.isArray(attr.L)) return attr.L.map(fromDynamoAttribute);
  if ('M' in attr && typeof attr.M === 'object') {
    const obj: Record<string, any> = {};
    for (const k of Object.keys(attr.M)) {
      obj[k] = fromDynamoAttribute(attr.M[k]);
    }
    return obj;
  }
  return null;
}

/**
 * Initializes and auto-provisions all YDB Document API tables & essential seed records.
 */
export async function initYandexTables(): Promise<{ success: boolean; createdCount: number }> {
  try {
    const listRes = await callYdbDocApi('DynamoDB_20120810.ListTables', {});
    const existing = (listRes.data?.TableNames as string[]) || [];

    let createdCount = 0;
    for (const table of YANDEX_REQUIRED_TABLES) {
      if (!existing.includes(table)) {
        const createRes = await callYdbDocApi('DynamoDB_20120810.CreateTable', {
          TableName: table,
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        });
        if (createRes.status === 200) {
          createdCount++;
        }
      }
    }

    // Seed Owner & Employee users if missing
    const initialUsers: Array<UserProfile & Record<string, any>> = [
      {
        id: 'usr-owner-1',
        email: 'amaas9499@gmail.com',
        name: 'Ahmed Abdallah',
        role: 'owner',
        activeRole: 'owner',
        roles: ['owner', 'employee', 'bank', 'buyer', 'seller', 'partner', 'investor'],
        phone: '+7 (999) 000-00-01',
        clientCode: 'DEX-OWNER',
        photoURL:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        isPartnerApproved: true,
        isInvestorApproved: true,
        partnerRefCode: 'PARTNER-MASTER-OWNER',
        favorites: [],
        registeredAt: new Date().toISOString(),
        authProvider: 'yandex',
      },
      {
        id: 'usr-curator-smirnov',
        email: 'amaas9494@gmail.com',
        name: 'Алексей Смирнов',
        role: 'employee',
        activeRole: 'employee',
        roles: ['employee', 'buyer', 'seller'],
        assignedEmployeeId: 'emp-1',
        phone: '+7 (921) 456-78-90',
        clientCode: 'DEX-STAFF',
        photoURL:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        isPartnerApproved: false,
        isInvestorApproved: false,
        favorites: [],
        registeredAt: new Date().toISOString(),
        authProvider: 'yandex',
      },
    ];

    for (const u of initialUsers) {
      const item: Record<string, any> = {};
      for (const k of Object.keys(u)) item[k] = toDynamoAttribute((u as any)[k]);
      await callYdbDocApi('DynamoDB_20120810.PutItem', { TableName: 'users', Item: item });
      await callYdbDocApi('DynamoDB_20120810.PutItem', { TableName: 'demo_users', Item: item });
    }

    // Seed default Market Settings
    const defaultMarket: MarketSettings = {
      id: 'singleton_market_settings',
      cbrKeyRatePercent: 21,
      familyMortgageRatePercent: 6,
      developerPenaltyPercent: 15,
      buyerCommissionPercent: 2.5,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Initialization',
    };
    const mItem: Record<string, any> = {};
    for (const k of Object.keys(defaultMarket)) mItem[k] = toDynamoAttribute((defaultMarket as any)[k]);
    await callYdbDocApi('DynamoDB_20120810.PutItem', { TableName: 'market_settings', Item: mItem });

    return { success: true, createdCount };
  } catch (err) {
    console.warn('[initYandexTables] Auto-provision warning:', err);
    return { success: false, createdCount: 0 };
  }
}
