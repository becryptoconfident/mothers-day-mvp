import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { confirmationEmail } from '@/lib/email-templates';
import { deliveryISOForDay, formatHumanDate, formatTime12 } from '@/lib/dates';
import { generateContent } from '@/lib/anthropic';
import { MESSAGES_SYSTEM_PROMPT, generateMessagesPrompt } from '@/lib/prompts';
import { signEditToken } from '@/lib/auth';
import { scheduleDailyEmails } from '@/lib/email-scheduler';

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

  const session = event.data.object as {
    id: string;
    payment_intent?: string;
    client_reference_id?: string;
    amount_total?: number;
    metadata?: Record<string, string>;
  };

  // Standalone tip (no order) — record and return.
  if (session.metadata?.standalone_tip === 'true') {
    try {
      await supabaseAdmin.from('analytics_events').insert({
        event_name: 'standalone_tip',
        properties: { amount_total: session.amount_total || 0, session: session.id },
      });
    } catch (e) {
      console.error('standalone tip log failed', e);
    }
    return NextResponse.json({ received: true, standaloneTip: true });
  }

  const orderId = session.client_reference_id;
  if (!orderId) {
    return NextResponse.json({ error: 'no client_reference_id' }, { status: 400 });
  }

  const isContribution = session.metadata?.contribution === 'true';

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchErr || !order) {
    await logEvent('stripe-webhook', 'order not found', { orderId, fetchErr, isContribution });
    return NextResponse.json({ error: 'order not found' }, { status: 404 });
  }

  // Contribution path: don't re-schedule, don't re-generate. Just record the
  // additional amount on the existing (already-paid) order.
  if (isContribution) {
    const added = session.amount_total || 0;
    const newTotal = (order.amount_paid || 0) + added;
    await supabaseAdmin
      .from('orders')
      .update({ amount_paid: newTotal })
      .eq('id', order.id);
    await logEvent('stripe-webhook', 'contribution recorded', {
      orderId,
      added,
      newTotal,
      session: session.id,
    });
    return NextResponse.json({ received: true, contribution: true, added });
  }

  if (order.paid) {
    await logEvent('stripe-webhook', 'duplicate (already paid)', { orderId });
    return NextResponse.json({ received: true, alreadyPaid: true });
  }

  await logEvent('stripe-webhook', 'received', {
    orderId,
    user_email: order.user_email,
    session_id: session.id,
  });

  // 1. Mark paid
  await supabaseAdmin
    .from('orders')
    .update({ paid: true, stripe_payment_intent: session.payment_intent || null })
    .eq('id', order.id);
  order.paid = true;

  // 2. Generate any missing messages. Preserve any user-edited day_1.
  const haveAllThree = ['day_1', 'day_2', 'day_3']
    .every((d) => typeof order.messages?.[d] === 'string' && order.messages[d].length);
  if (!haveAllThree) {
    try {
      const generated = await generateContent(
        MESSAGES_SYSTEM_PROMPT,
        generateMessagesPrompt({
          question_1: order.question_1,
          question_2: order.question_2,
          question_3: order.question_3,
          mom_nickname: order.forever_data?.mom_nickname || undefined,
          mom_name: order.mom_name || undefined,
          language: order.language || order.forever_data?.language || undefined,
        }),
      );
      const merged = {
        day_1: order.messages?.day_1 || generated.day_1,
        day_2: order.messages?.day_2 || generated.day_2,
        day_3: order.messages?.day_3 || generated.day_3,
      };
      order.messages = merged;
      await supabaseAdmin.from('orders').update({ messages: merged }).eq('id', order.id);
    } catch (e) {
      console.error('post-payment message gen failed:', e);
      // Continue with whatever we have; user can fill the rest via /edit.
    }
  }

  // 3. Schedule the 3 daily emails. The scheduler threads orderId+emailType
  //    through to sendEmail so the sent_emails gate fires on every send.
  const { scheduledIds, failures } = await scheduleDailyEmails(order);
  if (failures.length) {
    await logEvent('stripe-webhook:schedule-fail', 'one or more daily emails failed to schedule', {
      orderId: order.id,
      failures,
    });
  }

  // 4. Send confirmation immediately (also gated).
  const editToken = signEditToken(order.id);
  const editUrl = `${process.env.NEXT_PUBLIC_URL}/edit/${order.id}#t=${editToken}`;
  const firstSendISO = deliveryISOForDay(1, order.delivery_time || '09:00', order.delivery_timezone);
  const firstSendPretty = formatHumanDate(firstSendISO, order.delivery_timezone);
  const landingUrl = process.env.NEXT_PUBLIC_URL || '';
  const contributeUrl = `${landingUrl}/success?orderId=${order.id}#contribute`;
  const conf = confirmationEmail({
    orderId: order.id,
    momName: order.mom_name || undefined,
    editUrl,
    firstSendDate: `${firstSendPretty} at ${formatTime12(order.delivery_time || '09:00')}`,
    isFree: false,
    landingUrl,
    contributeUrl,
  });
  const confRes = await sendEmail({
    to: order.user_email,
    subject: conf.subject,
    html: conf.html,
    tag: 'confirmation',
    orderId: order.id,
    emailType: 'confirmation',
  });
  if (confRes.ok) scheduledIds['confirmation'] = confRes.id;
  else
    await logEvent('stripe-webhook:resend-fail', 'confirmation send failed', {
      orderId: order.id,
      error: confRes.error,
      to: order.user_email,
    });

  await supabaseAdmin
    .from('orders')
    .update({ scheduled_email_ids: scheduledIds })
    .eq('id', order.id);

  // 5. Warm the forever page (everyone gets one now). Fire-and-forget.
  void fetch(`${process.env.NEXT_PUBLIC_URL}/api/warm-forever-page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId: order.id }),
  }).catch((e) => {
    console.warn('warm-forever-page kickoff failed', e);
  });

  await logEvent('stripe-webhook', 'completed', {
    orderId,
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
    console.error('logEvent failed', e, msg, context);
  }
}
