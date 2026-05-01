// Authoritative update for the forever page's editable bits.
// Auth: orderId in body is the capability URL — same model as /forever/[id].
// Merges into forever_data; never overwrites cleaned_answers / generated_letter.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const MAX_EXTRAS = 6;
const MAX_CAPTION = 160;

type ExtraMedia = { url: string };
type MothersDayPhoto = { url: string; caption?: string };

function looksLikeMediaUrl(u: unknown): u is string {
  if (typeof u !== 'string' || !u.trim()) return false;
  return u.startsWith('/api/media/') || /^https?:\/\//.test(u);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = typeof body.orderId === 'string' ? body.orderId : null;
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const { data: order, error: fetchErr } = await supabaseAdmin
      .from('orders')
      .select('id,paid,forever_data')
      .eq('id', orderId)
      .maybeSingle();
    if (fetchErr || !order) {
      return NextResponse.json({ error: 'order not found' }, { status: 404 });
    }
    if (!order.paid) {
      return NextResponse.json({ error: 'order not finalized' }, { status: 400 });
    }

    const fd: Record<string, unknown> = order.forever_data || {};
    const next: Record<string, unknown> = { ...fd };

    if (Array.isArray(body.extra_media)) {
      const cleaned: ExtraMedia[] = body.extra_media
        .map((m: unknown) => {
          if (m && typeof m === 'object' && looksLikeMediaUrl((m as { url?: unknown }).url)) {
            return { url: (m as { url: string }).url };
          }
          return null;
        })
        .filter((x: ExtraMedia | null): x is ExtraMedia => x !== null)
        .slice(0, MAX_EXTRAS);
      next.extra_media = cleaned;
    }

    if (body.captions && typeof body.captions === 'object' && !Array.isArray(body.captions)) {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(body.captions as Record<string, unknown>)) {
        if (!/^\d+$/.test(k)) continue;
        if (typeof v !== 'string') continue;
        cleaned[k] = v.slice(0, MAX_CAPTION);
      }
      next.captions = cleaned;
    }

    if (body.mothers_day_photo === null) {
      delete next.mothers_day_photo;
    } else if (body.mothers_day_photo && typeof body.mothers_day_photo === 'object') {
      const obj = body.mothers_day_photo as { url?: unknown; caption?: unknown };
      if (looksLikeMediaUrl(obj.url)) {
        const photo: MothersDayPhoto = { url: obj.url };
        if (typeof obj.caption === 'string') photo.caption = obj.caption.slice(0, MAX_CAPTION);
        next.mothers_day_photo = photo;
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({ forever_data: next })
      .eq('id', orderId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('forever-update error', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
