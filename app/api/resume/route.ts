// Resume lookup: returns the saved draft_state for a pre-payment order so
// /resume/[orderId] can rehydrate the user's /preview state from any device.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,paid,forever_data')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const fd = (data.forever_data || {}) as { draft_state?: unknown };
  return NextResponse.json({
    paid: !!data.paid,
    draft: fd.draft_state || null,
  });
}
