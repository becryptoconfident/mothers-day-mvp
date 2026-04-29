import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import {
  dailyMessageEmail,
  gentleReminderEmail,
  confirmationEmail,
  editClosingReminderEmail,
  foreverPageEmail,
} from '@/lib/email-templates';
import { deliveryISOForDay, localToUTC, formatHumanDate, EDIT_CLOSE_DATE } from '@/lib/dates';
import { generateContent } from '@/lib/anthropic';
import {
  MESSAGES_SYSTEM_PROMPT,
  generateMessagesPrompt,
} from '@/lib/prompts';
import { signEditToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature') || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret not set' }, { status: 500 });
  }

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    console.error('webhook sig fail', e);
    return new Response(`Webhook Error: ${(e as Error).message}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as { id: string; payment_intent?: string; client_reference_id?: string };
  const orderId = session.client_reference_id;
  if (!orderId) {
    return NextResponse.json({ error: 'no client_reference_id' }, { status: 400 });
  }

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) {
    await logEvent('stripe-webhook', 'order not found', { orderId, fetchErr });
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }

  if (order.paid) {
    await logEvent('stripe-webhook', 'duplicate (already paid)', { orderId });
    return NextResponse.json({ received: true, alreadyPaid: true });
  }

  await logEvent('stripe-webhook', 'received', {
    orderId,
    tier: order.tier,
    user_email: order.user_email,
    session_id: session.id,
  });

  // 1. Mark paid
  await supabaseAdmin
    .from('orders')
    .update({ paid: true, stripe_payment_intent: session.payment_intent || null })
    .eq('id', order.id);

  // 1b. Generate Days 2-7 (only Day 1 was generated pre-payment as a sample).
  // If user edited Day 1 in /preview, preserve their version.
  const haveAllSeven = ['day_2', 'day_3', 'day_4', 'day_5', 'day_6', 'day_7']
    .every((d) => typeof order.messages?.[d] === 'string' && order.messages[d].length);
  if (!haveAllSeven) {
    try {
      const generated = await generateContent(
        MESSAGES_SYSTEM_PROMPT,
        generateMessagesPrompt({
          question_1: order.question_1,
          question_2: order.question_2,
          question_3: order.question_3,
          question_4: order.question_4,
        }),
      );
      const merged = {
        ...generated,
        day_1: order.messages?.day_1 || generated.day_1,
      };
      order.messages = merged;
      await supabaseAdmin.from('orders').update({ messages: merged }).eq('id', order.id);
    } catch (e) {
      console.error('post-payment full-message gen failed:', e);
      // Continue with day_1 only; user can fill the rest via /edit.
    }
  }

  // 2. Schedule 7 daily morning emails — TO THE BUYER. They copy/paste to mom.
  // Default time = 8am (was 9am — Memphis revised in the new spec).
  const morningTime = order.delivery_time || '08:00';
  const scheduledIds: Record<string, string> = {};
  for (let day = 1; day <= 7; day++) {
    const message = order.messages[`day_${day}`];
    if (!message) continue;
    const dayMedia = (order.media || []).filter((m: { day: number }) => m.day === day);
    const tpl = dailyMessageEmail({
      day: day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      message,
      momName: order.mom_name || undefined,
      media: dayMedia,
      isFinale: day === 7,
    });
    const sendAt = deliveryISOForDay(
      day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      morningTime,
      order.delivery_timezone,
    );
    const r = await sendEmail({
      to: order.user_email,
      subject: tpl.subject,
      html: tpl.html,
      scheduledAt: sendAt,
      tag: `day-${day}`,
    });
    if (r.ok) scheduledIds[`day_${day}`] = r.id;
    else console.warn(`schedule day ${day} failed: ${r.error}`);

    // Optional gentle afternoon reminder (ADHD/ND opt-in) — also to the buyer.
    if (order.extra_reminders) {
      const gentleTpl = gentleReminderEmail({
        day: day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        message,
        momName: order.mom_name || undefined,
      });
      const gentleAt = deliveryISOForDay(
        day as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        '13:00',
        order.delivery_timezone,
      );
      const gr = await sendEmail({
        to: order.user_email,
        subject: gentleTpl.subject,
        html: gentleTpl.html,
        scheduledAt: gentleAt,
        tag: `gentle-${day}`,
      });
      if (gr.ok) scheduledIds[`gentle_${day}`] = gr.id;
    }
  }

  // 3. Edit-closing reminder (May 2, 9am user-local) — only if still in window
  const editClose = localToUTC(EDIT_CLOSE_DATE, '09:00', order.delivery_timezone);
  if (new Date(editClose) > new Date()) {
    const editToken = signEditToken(order.id);
    const editUrl = `${process.env.NEXT_PUBLIC_URL}/edit/${order.id}#t=${editToken}`;
    const tpl = editClosingReminderEmail({ editUrl });
    const r = await sendEmail({
      to: order.user_email,
      subject: tpl.subject,
      html: tpl.html,
      scheduledAt: editClose,
      tag: 'edit-close',
    });
    if (r.ok) scheduledIds['edit_close'] = r.id;
  }

  // 4. Tier 3 — schedule the Mother's Day morning email with the Forever Page link.
  // The page itself is lazy-generated on first visit (cleaned text + AI letter
  // cached into orders.forever_data on first render), so no AI calls happen here.
  if (order.tier === 3) {
    const foreverAt = localToUTC('2026-05-10', '09:00', order.delivery_timezone);
    const foreverUrl = `${process.env.NEXT_PUBLIC_URL}/forever/${order.id}`;
    const tpl = foreverPageEmail({
      foreverUrl,
      momName: order.mom_name || undefined,
      userName: order.user_name || undefined,
    });
    const r = await sendEmail({
      to: order.user_email,
      subject: tpl.subject,
      html: tpl.html,
      scheduledAt: foreverAt,
      tag: 'forever-page',
    });
    if (r.ok) scheduledIds['forever_page'] = r.id;
  }

  // 5. Send confirmation immediately
  const editToken2 = signEditToken(order.id);
  const editUrl2 = `${process.env.NEXT_PUBLIC_URL}/edit/${order.id}#t=${editToken2}`;
  const firstSendISO = deliveryISOForDay(1, order.delivery_time, order.delivery_timezone);
  const firstSendPretty = formatHumanDate(firstSendISO, order.delivery_timezone);
  const conf = confirmationEmail({
    orderId: order.id,
    tier: order.tier,
    momName: order.mom_name || undefined,
    editUrl: editUrl2,
    firstSendDate: `${firstSendPretty} at ${order.delivery_time}`,
  });
  const confRes = await sendEmail({
    to: order.user_email,
    subject: conf.subject,
    html: conf.html,
    tag: 'confirmation',
  });
  if (confRes.ok) scheduledIds['confirmation'] = confRes.id;

  await supabaseAdmin
    .from('orders')
    .update({ scheduled_email_ids: scheduledIds })
    .eq('id', order.id);

  // Tier 3 — fire-and-forget warm-up so the AI letter + cleaned text are
  // generated/cached in the background. Doesn't block the webhook response.
  if (order.tier === 3) {
    void fetch(`${process.env.NEXT_PUBLIC_URL}/api/warm-forever-page`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    }).catch((e) => {
      // Warm-up failure isn't fatal — page lazy-generates on first visit.
      console.warn('warm-forever-page kickoff failed', e);
    });
  }

  await logEvent('stripe-webhook', 'completed', {
    orderId,
    tier: order.tier,
    scheduled: Object.keys(scheduledIds),
  });

  return NextResponse.json({ received: true, scheduled: Object.keys(scheduledIds).length });
}

async function logEvent(endpoint: string, msg: string, context: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('error_logs').insert({
      endpoint,
      error: msg,
      context,
    });
  } catch (e) {
    // Last-ditch console fallback if even the log write fails.
    console.error('logEvent failed', e, msg, context);
  }
}
