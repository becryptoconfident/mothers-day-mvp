import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id,tier,paid,mom_name,user_name,hunt_clues,hunt_finale,hunt_progress,hunt_started_at,hunt_completed_at')
    .eq('id', orderId)
    .single();

  if (error || !order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!order.paid) return NextResponse.json({ error: 'not active' }, { status: 403 });
  if (order.tier !== 3) return NextResponse.json({ error: 'no hunt on this order' }, { status: 404 });

  const clues = Array.isArray(order.hunt_clues) ? order.hunt_clues : [];
  const progress = order.hunt_progress || {
    current_clue: 0,
    hints_revealed: {},
    completed: false,
  };

  // Mark started on first GET
  if (!order.hunt_started_at) {
    await supabaseAdmin
      .from('orders')
      .update({ hunt_started_at: new Date().toISOString() })
      .eq('id', order.id);
  }

  return NextResponse.json({
    order_id: order.id,
    mom_name: order.mom_name,
    user_name: order.user_name,
    clues,
    finale: order.hunt_finale || { message: '' },
    progress,
  });
}

export async function POST(req: Request) {
  try {
    const { orderId, progress } = await req.json();
    if (!orderId || !progress) {
      return NextResponse.json({ error: 'orderId and progress required' }, { status: 400 });
    }
    const update: Record<string, unknown> = { hunt_progress: progress };
    if (progress.completed) {
      update.hunt_completed_at = new Date().toISOString();
    }
    await supabaseAdmin.from('orders').update(update).eq('id', orderId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
