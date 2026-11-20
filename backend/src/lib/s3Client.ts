import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getConfig } from './config.js';

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const cfg = getConfig();
    s3ClientInstance = new S3Client({
      endpoint: cfg.S3_ENDPOINT,
      region: cfg.YDB_REGION,
      credentials: {
        accessKeyId: cfg.YC_ACCESS_KEY_ID,
        secretAccessKey: cfg.YC_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
}

export async function createPresignedUploadUrl(options: {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
    ContentType: options.contentType,
  });

  return await getSignedUrl(client, command, {
    expiresIn: options.expiresInSeconds || 300,
  });
}

export async function createPresignedDownloadUrl(options: {
  bucket: string;
  key: string;
  originalFilename?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
    ResponseContentDisposition: options.originalFilename
      ? `attachment; filename="${encodeURIComponent(options.originalFilename)}"`
      : undefined,
  });

  return await getSignedUrl(client, command, {
    expiresIn: options.expiresInSeconds || 900,
  });
}

export async function deleteS3Object(bucket: string, key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function deleteS3ObjectsByPrefix(bucket: string, prefix: string): Promise<number> {
  const client = getS3Client();
  let deletedCount = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const listRes: any = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (listRes.Contents && listRes.Contents.length > 0) {
      const objectsToDelete = listRes.Contents.map((obj: any) => ({ Key: obj.Key! }));
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objectsToDelete,
            Quiet: true,
          },
        })
      );
      deletedCount += objectsToDelete.length;
    }

    continuationToken = listRes.NextContinuationToken;
  } while (continuationToken);

  return deletedCount;
}
