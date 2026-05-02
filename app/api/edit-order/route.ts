import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyEditToken } from '@/lib/auth';
import { isEditWindowOpen } from '@/lib/dates';
import { cancelEmail } from '@/lib/resend';
import { scheduleDailyEmails } from '@/lib/email-scheduler';

const EDITABLE_FIELDS = new Set([
  'messages',
  'media',
  'mom_email',
  'mom_name',
  'user_name',
  'delivery_time',
  'delivery_timezone',
  'language',
  'delivery_mode',
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('orderId');
  const token = url.searchParams.get('token');
  if (!orderId || !token) {
    return NextResponse.json({ error: 'orderId and token required' }, { status: 400 });
  }
  const v = verifyEditToken(token);
  if (!v.ok || v.orderId !== orderId) {
    return NextResponse.json({ error: 'invalid or expired link' }, { status: 401 });
  }
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (error || !order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ order });
}

export async function POST(req: Request) {
  try {
    const { orderId, token, patch } = await req.json();
    if (!orderId || !token || !patch) {
      return NextResponse.json({ error: 'orderId, token, patch required' }, { status: 400 });
    }
    const v = verifyEditToken(token);
    if (!v.ok || v.orderId !== orderId) {
      return NextResponse.json({ error: 'invalid or expired link' }, { status: 401 });
    }

    const { data: existing } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

    if (existing.edit_locked || !isEditWindowOpen(existing.delivery_timezone)) {
      return NextResponse.json({ error: 'edit window closed' }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(patch)) {
      if (EDITABLE_FIELDS.has(k)) update[k] = val;
    }
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }

    // If switching to direct-to-mom delivery, mom_email must be valid in the
    // resulting state (either freshly patched or already on the row).
    const merged = { ...existing, ...update } as Record<string, unknown>;
    if (merged.delivery_mode === 'mom') {
      const email = merged.mom_email;
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: 'mom_email required for direct-to-mom delivery' },
          { status: 400 },
        );
      }
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', orderId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // If anything that affects scheduled-message content/timing changed →
    // cancel all Resend-scheduled emails AND clear the sent_emails claims so
    // the scheduler can re-claim and re-send.
    const reschedule =
      'messages' in update ||
      'media' in update ||
      'delivery_time' in update ||
      'delivery_timezone' in update;

    if (reschedule) {
      const oldIds = (existing.scheduled_email_ids || {}) as Record<string, string>;

      for (const id of Object.values(oldIds)) {
        if (id) await cancelEmail(id);
      }

      await supabaseAdmin
        .from('sent_emails')
        .delete()
        .eq('order_id', orderId)
        .in('email_type', [
          'message_day_1', 'message_day_2', 'message_day_3',
          'mom_message_day_1', 'mom_message_day_2', 'mom_message_day_3',
        ]);

      const { scheduledIds } = await scheduleDailyEmails(
        merged as unknown as Parameters<typeof scheduleDailyEmails>[0],
      );

      await supabaseAdmin
        .from('orders')
        .update({ scheduled_email_ids: scheduledIds })
        .eq('id', orderId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
