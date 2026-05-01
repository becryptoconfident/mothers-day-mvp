// Public proxy for R2-stored media. Browser/email clients fetch images and
// other media via /api/media/<key> instead of hitting R2 directly. Server-side
// credentials (R2_ACCESS_KEY_ID etc.) sign the GET, so the bucket can stay
// private. Path is the capability — UUID prefixes make keys unguessable.

import { getR2Object } from '@/lib/r2';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!path || !path.length) {
    return new Response('not found', { status: 404 });
  }
  const key = path.join('/');
  // Whitelist: only paths the upload route writes ever start with these.
  if (!key.startsWith('orders/') && !key.startsWith('forever/')) {
    return new Response('not found', { status: 404 });
  }
  try {
    const obj = await getR2Object(key);
    if (!obj.Body) {
      return new Response('not found', { status: 404 });
    }
    // Body is a Readable on Node runtime; cast to a web ReadableStream for the
    // Response constructor.
    const body = obj.Body as unknown as ReadableStream;
    const headers = new Headers();
    headers.set('Content-Type', obj.ContentType || 'application/octet-stream');
    if (obj.ContentLength) headers.set('Content-Length', String(obj.ContentLength));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(body, { status: 200, headers });
  } catch (e) {
    const msg = (e as Error).message;
    // Treat known "not found" errors as 404 rather than leaking 500s.
    if (/NoSuchKey|NotFound|404/i.test(msg)) {
      return new Response('not found', { status: 404 });
    }
    console.error('media proxy error', e);
    return new Response('server error', { status: 500 });
  }
}
