import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Module-scope cached client across warm serverless container invocations
let cachedS3Client: S3Client | null = null;
let clientCreatedTimestamp = 0;
const CLIENT_MAX_AGE_MS = 15 * 60 * 1000; // 15-minute refresh boundary

function getS3Client(): S3Client {
  const now = Date.now();
  if (cachedS3Client && now - clientCreatedTimestamp < CLIENT_MAX_AGE_MS) {
    return cachedS3Client;
  }

  const endpoint =
    process.env.VITE_YANDEX_STORAGE_ENDPOINT ||
    process.env.YANDEX_STORAGE_ENDPOINT ||
    'https://storage.yandexcloud.net';
  const region =
    process.env.VITE_YANDEX_REGION ||
    process.env.YANDEX_REGION ||
    'ru-central1';
  const accessKeyId =
    process.env.VITE_YANDEX_ACCESS_KEY_ID ||
    process.env.YANDEX_ACCESS_KEY_ID ||
    '';
  const secretAccessKey =
    process.env.VITE_YANDEX_SECRET_ACCESS_KEY ||
    process.env.YANDEX_SECRET_ACCESS_KEY ||
    '';

  cachedS3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
  clientCreatedTimestamp = now;

  return cachedS3Client;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const bucket =
      process.env.VITE_YANDEX_STORAGE_BUCKET ||
      process.env.YANDEX_STORAGE_BUCKET ||
      'domexit-storage-vault';

    let objectKey = '';
    let contentType = 'application/octet-stream';
    let fileBuffer: Buffer | null = null;

    if (event.body) {
      if (typeof event.body === 'string' && event.body.trim().startsWith('{')) {
        const parsed = JSON.parse(event.body);
        objectKey = parsed.objectKey || parsed.key || '';
        contentType = parsed.contentType || parsed.mimeType || 'application/octet-stream';
        const base64Content = parsed.base64Data || parsed.dataUrl || parsed.content || '';
        const cleanBase64 = base64Content.replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(cleanBase64, 'base64');
      } else if (event.isBase64Encoded) {
        fileBuffer = Buffer.from(event.body, 'base64');
        objectKey = event.queryStringParameters?.key || event.queryStringParameters?.objectKey || '';
        contentType = event.queryStringParameters?.contentType || event.headers['content-type'] || 'application/octet-stream';
      } else {
        fileBuffer = Buffer.from(event.body, 'utf-8');
        objectKey = event.queryStringParameters?.key || event.queryStringParameters?.objectKey || '';
        contentType = event.queryStringParameters?.contentType || event.headers['content-type'] || 'application/octet-stream';
      }
    }

    if (!objectKey) {
      objectKey = `uploads/file_${Date.now()}`;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Empty file buffer or missing payload' }),
      };
    }

    const s3Client = getS3Client();
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read',
      })
    );

    const publicUrl = `https://storage.yandexcloud.net/${bucket}/${objectKey}`;

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        bucket,
        objectKey,
        storageKey: objectKey,
        url: publicUrl,
        sizeBytes: fileBuffer.length,
        contentType,
      }),
    };
  } catch (error: any) {
    console.error('[s3-upload function error]:', error);
    return {
      statusCode: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: error.message || 'S3 upload failed',
      }),
    };
  }
};
