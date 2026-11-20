import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getS3Client() {
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

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
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

    const objectKey =
      event.queryStringParameters?.key ||
      event.queryStringParameters?.objectKey ||
      '';

    if (!objectKey) {
      return {
        statusCode: 400,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing object key' }),
      };
    }

    const s3Client = getS3Client();
    const mode = event.queryStringParameters?.mode || event.queryStringParameters?.format;

    // Mode: JSON presigned URL generator
    if (mode === 'json' || mode === 'presigned') {
      const presignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
        { expiresIn: 7200 }
      );

      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          objectKey,
          presignedUrl,
        }),
      };
    }

    // Default Mode: Direct Binary Streaming
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    const response = await s3Client.send(getCommand);
    const contentType = response.ContentType || 'application/octet-stream';
    const filename = objectKey.split('/').pop() || 'document';

    // Stream to Buffer
    const stream = response.Body as any;
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=86400',
      },
      body: fileBuffer.toString('base64'),
    };
  } catch (error: any) {
    console.error('[s3-download function error]:', error);
    return {
      statusCode: 404,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: error.message || 'File not found in S3 bucket',
      }),
    };
  }
};
