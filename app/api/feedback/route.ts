// Lightweight feedback endpoint. Writes to analytics_events.
// No auth — anyone with the order URL can submit, which is fine for low-stakes
// signal. Don't trust the orderId-event pairing for any high-stakes decisions.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = typeof body.orderId === 'string' ? body.orderId : null;
    const event = typeof body.event === 'string' ? body.event : null;
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 2000) : null;
    if (!orderId || !event) {
      return NextResponse.json({ error: 'orderId and event required' }, { status: 400 });
    }
    const allowed = new Set(['feedback_positive', 'feedback_negative', 'feedback_comment']);
    if (!allowed.has(event)) {
      return NextResponse.json({ error: 'unknown event' }, { status: 400 });
    }
    await supabaseAdmin.from('analytics_events').insert({
      order_id: orderId,
      event_name: event,
      properties: { comment },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
