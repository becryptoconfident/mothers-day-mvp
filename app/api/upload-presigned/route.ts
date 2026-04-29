import { NextResponse } from 'next/server';
import { presignUpload, isAllowedContentType, r2Configured } from '@/lib/r2';

export async function POST(req: Request) {
  try {
    if (!r2Configured()) {
      return NextResponse.json(
        { error: 'media uploads not configured (R2 keys missing)' },
        { status: 503 },
      );
    }
    const body = await req.json();
    const { day, contentType, filename, orderId } = body || {};
    // day === 0 is the dedicated Forever Page video slot (not tied to a daily message).
    // days 1–7 are the per-day media slots used by tier 2/3 daily emails.
    if (typeof day !== 'number' || day < 0 || day > 7) {
      return NextResponse.json({ error: 'day must be 0-7' }, { status: 400 });
    }
    if (typeof contentType !== 'string' || !isAllowedContentType(contentType)) {
      return NextResponse.json({ error: `content-type ${contentType} not allowed` }, { status: 400 });
    }
    const { uploadUrl, publicUrl, key } = await presignUpload({
      orderId: orderId || 'pending',
      day,
      contentType,
      filename,
    });
    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
