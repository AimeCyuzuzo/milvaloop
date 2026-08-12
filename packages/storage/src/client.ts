import { Client } from 'minio';

export interface StorageConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export function createStorageClient(config: StorageConfig) {
  const client = new Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  async function ensureBucket() {
    const exists = await client.bucketExists(config.bucket);
    if (!exists) {
      await client.makeBucket(config.bucket);
    }
  }

  async function putObject(objectName: string, data: Buffer, contentType?: string) {
    await client.putObject(config.bucket, objectName, data, undefined, {
      ...(contentType ? { 'Content-Type': contentType } : {}),
    });
  }

  async function getPresignedUrl(objectName: string, expirySeconds = 3600) {
    return client.presignedGetObject(config.bucket, objectName, expirySeconds);
  }

  async function removeObject(objectName: string) {
    await client.removeObject(config.bucket, objectName);
  }

  return { client, bucket: config.bucket, ensureBucket, putObject, getPresignedUrl, removeObject };
}

export type StorageClient = ReturnType<typeof createStorageClient>;
