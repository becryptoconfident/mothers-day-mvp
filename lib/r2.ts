// Cloudflare R2 — S3-compatible. Used only on the server side.
// Generates presigned PUT URLs so the browser uploads directly without
// proxying through Next.

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || 'mothers-day-media';
// Note: we do NOT use R2_PUBLIC_URL for browser-facing image URLs — that
// variable typically points at the S3 API endpoint which requires auth.
// Instead we proxy via /api/media/[...path] using server-side credentials.
const SITE_URL = process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') || '';

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
  return Boolean(ACCOUNT_ID && ACCESS_KEY && SECRET_KEY);
}

/** Server-side fetch of a stored object. Used by the /api/media proxy route. */
export async function getR2Object(key: string) {
  if (!r2Configured()) throw new Error('R2 not configured');
  return client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
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
  'audio/webm': 10 * 1024 * 1024,
  'audio/ogg': 10 * 1024 * 1024,
};

// Browsers (especially Chrome's MediaRecorder) often send content types with
// codec params, e.g. "audio/webm;codecs=opus". Strip those before checking.
function baseType(ct: string): string {
  return (ct || '').split(';')[0].trim().toLowerCase();
}

export function isAllowedContentType(ct: string): boolean {
  return baseType(ct) in CONTENT_TYPE_LIMITS;
}

export function maxBytesForType(ct: string): number {
  return CONTENT_TYPE_LIMITS[baseType(ct)] || 0;
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
  // Strip codec params from content type before signing — keeps the
  // presigned signature stable regardless of how the client passes it.
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: baseType(args.contentType),
  });
  const uploadUrl = await getSignedUrl(client(), cmd, {
    expiresIn: args.expiresInSeconds ?? 600,
  });
  // Browser-facing URL points at our /api/media proxy. SITE_URL is absolute
  // (needed for emails), but the proxy works the same locally and in prod.
  const publicUrl = `${SITE_URL}/api/media/${key}`;
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
  const base = baseType(contentType);
  if (base === 'image/jpeg') return '.jpg';
  if (base === 'image/png') return '.png';
  if (base === 'image/gif') return '.gif';
  if (base === 'image/webp') return '.webp';
  if (base === 'video/mp4') return '.mp4';
  if (base === 'video/quicktime') return '.mov';
  if (base === 'audio/mpeg') return '.mp3';
  if (base === 'audio/mp4' || base.endsWith('m4a')) return '.m4a';
  if (base === 'audio/wav') return '.wav';
  if (base === 'audio/webm') return '.webm';
  if (base === 'audio/ogg') return '.ogg';
  return '';
}
