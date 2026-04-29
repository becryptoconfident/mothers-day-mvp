// Cloudflare R2 — S3-compatible. Used only on the server side.
// Generates presigned PUT URLs so the browser uploads directly without
// proxying through Next.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || 'mothers-day-media';
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';

let _client: S3Client | null = null;

function client(): S3Client {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('R2 not configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
  }
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
  }
  return _client;
}

export function r2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY && PUBLIC_URL);
}

const CONTENT_TYPE_LIMITS: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'video/mp4': 100 * 1024 * 1024,
  'video/quicktime': 100 * 1024 * 1024,
  'audio/mpeg': 10 * 1024 * 1024,
  'audio/mp4': 10 * 1024 * 1024,
  'audio/m4a': 10 * 1024 * 1024,
  'audio/x-m4a': 10 * 1024 * 1024,
  'audio/wav': 10 * 1024 * 1024,
};

export function isAllowedContentType(ct: string): boolean {
  return ct in CONTENT_TYPE_LIMITS;
}

export function maxBytesForType(ct: string): number {
  return CONTENT_TYPE_LIMITS[ct] || 0;
}

/** Returns presigned PUT URL + the eventual public URL. Browser uploads to PUT URL. */
export async function presignUpload(args: {
  orderId: string;
  day: number;
  contentType: string;
  filename?: string;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!r2Configured()) throw new Error('R2 not configured');
  if (!isAllowedContentType(args.contentType)) {
    throw new Error(`content-type ${args.contentType} not allowed`);
  }
  const ext = guessExt(args.contentType, args.filename);
  // day === 0 → Forever Page video slot. Distinct path prevents collision with
  // per-day media keys (orders/<id>/day-N-…).
  const key =
    args.day === 0
      ? `forever/${args.orderId}/video-${Date.now()}${ext}`
      : `orders/${args.orderId}/day-${args.day}-${Date.now()}${ext}`;
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: args.contentType,
  });
  const uploadUrl = await getSignedUrl(client(), cmd, {
    expiresIn: args.expiresInSeconds ?? 600,
  });
  const publicUrl = `${PUBLIC_URL}/${key}`;
  return { uploadUrl, publicUrl, key };
}

export async function deleteR2Object(key: string): Promise<void> {
  if (!r2Configured()) return;
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

function guessExt(contentType: string, filename?: string): string {
  if (filename) {
    const m = filename.match(/\.[a-zA-Z0-9]{1,5}$/);
    if (m) return m[0].toLowerCase();
  }
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/gif') return '.gif';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'video/mp4') return '.mp4';
  if (contentType === 'video/quicktime') return '.mov';
  if (contentType === 'audio/mpeg') return '.mp3';
  if (contentType === 'audio/mp4' || contentType.endsWith('m4a')) return '.m4a';
  if (contentType === 'audio/wav') return '.wav';
  return '';
}
