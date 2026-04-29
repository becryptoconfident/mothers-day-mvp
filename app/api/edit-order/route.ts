import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyEditToken } from '@/lib/auth';
import { isEditWindowOpen, deliveryISOForDay } from '@/lib/dates';
import { sendEmail, cancelEmail } from '@/lib/resend';
import { dailyMessageEmail, gentleReminderEmail } from '@/lib/email-templates';

const EDITABLE_FIELDS = new Set([
  'messages',
  'media',
  'mom_email',
  'mom_name',
  'user_name',
  'delivery_time',
  'delivery_timezone',
  'extra_reminders',
  'hunt_clues',
  'hunt_finale',
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

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', orderId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // If messages, media, or delivery preferences changed → cancel & re-schedule daily emails
    const reschedule =
      'messages' in update ||
      'media' in update ||
      'delivery_time' in update ||
      'delivery_timezone' in update ||
      'extra_reminders' in update;

    if (reschedule) {
      const merged = { ...existing, ...update };
      const oldIds = (existing.scheduled_email_ids || {}) as Record<string, string>;
      const newIds: Record<string, string> = { ...oldIds };

      const morningTime = merged.delivery_time || '08:00';
      for (let day = 1; day <= 7; day++) {
        const oldId = oldIds[`day_${day}`];
        if (oldId) await cancelEmail(oldId);
        const oldGentleId = oldIds[`gentle_${day}`];
        if (oldGentleId) await cancelEmail(oldGentleId);

        const message = merged.messages[`day_${day}`];
        if (!message) continue;
        const dayMedia = (merged.media || []).filter((m: { day: number }) => m.day === day);
        const tpl = dailyMessageEmail({
          day: day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          message,
          momName: merged.mom_name || undefined,
          media: dayMedia,
          isFinale: day === 7,
        });
        const sendAt = deliveryISOForDay(
          day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
          morningTime,
          merged.delivery_timezone,
        );
        const r = await sendEmail({
          to: merged.user_email,
          subject: tpl.subject,
          html: tpl.html,
          scheduledAt: sendAt,
          tag: `day-${day}`,
        });
        if (r.ok) newIds[`day_${day}`] = r.id;
        else delete newIds[`day_${day}`];

        if (merged.extra_reminders) {
          const gentleTpl = gentleReminderEmail({
            day: day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            message,
            momName: merged.mom_name || undefined,
          });
          const gentleAt = deliveryISOForDay(
            day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            '13:00',
            merged.delivery_timezone,
          );
          const gr = await sendEmail({
            to: merged.user_email,
            subject: gentleTpl.subject,
            html: gentleTpl.html,
            scheduledAt: gentleAt,
            tag: `gentle-${day}`,
          });
          if (gr.ok) newIds[`gentle_${day}`] = gr.id;
          else delete newIds[`gentle_${day}`];
        }
      }

      await supabaseAdmin
        .from('orders')
        .update({ scheduled_email_ids: newIds })
        .eq('id', orderId);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
