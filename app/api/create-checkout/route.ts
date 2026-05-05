import { NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { confirmationEmail } from '@/lib/email-templates';
import { deliveryISOForDay, formatHumanDate, formatTime12 } from '@/lib/dates';
import { signEditToken } from '@/lib/auth';
import { scheduleDailyEmails } from '@/lib/email-scheduler';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount) || 0;
    const contact = body.contact || {};
    const answers = body.answers || {};
    const messages = body.messages;
    const media = Array.isArray(body.media) ? body.media : [];
    const foreverData = body.forever_data || {};
    const language =
      typeof body.language === 'string' && body.language.trim() ? body.language.trim() : 'English';
    const deliveryMode: 'self' | 'mom' = body.delivery_mode === 'mom' ? 'mom' : 'self';

    const requiredContact = ['user_email', 'delivery_time', 'delivery_timezone'];
    for (const k of requiredContact) {
      if (!contact[k]) return NextResponse.json({ error: `missing contact.${k}` }, { status: 400 });
    }
    if (!isEmail(contact.user_email)) {
      return NextResponse.json({ error: 'invalid user_email' }, { status: 400 });
    }
    if (contact.mom_email && !isEmail(contact.mom_email)) {
      return NextResponse.json({ error: 'invalid mom_email' }, { status: 400 });
    }
    if (deliveryMode === 'mom' && !isEmail(contact.mom_email)) {
      return NextResponse.json({ error: 'mom_email required for direct-to-mom delivery' }, { status: 400 });
    }
    if (!messages || typeof messages !== 'object') {
      return NextResponse.json({ error: 'missing messages' }, { status: 400 });
    }
    for (const k of ['day_1', 'day_2', 'day_3']) {
      if (typeof messages[k] !== 'string' || !messages[k].trim()) {
        return NextResponse.json({ error: `messages.${k} missing` }, { status: 400 });
      }
    }
    const requiredAnswers = ['question_1', 'question_2', 'question_3', 'question_4'];
    for (const k of requiredAnswers) {
      if (typeof answers[k] !== 'string' || answers[k].trim().length < 20) {
        return NextResponse.json({ error: `${k} missing or too short` }, { status: 400 });
      }
    }

    const isFree = amount <= 0;
    const amountCents = isFree ? 0 : Math.round(amount * 100);

    const baseRow = {
      tier: 3, // legacy column; everyone gets everything
      user_email: contact.user_email,
      user_name: contact.user_name || null,
      mom_email: contact.mom_email || null,
      // mom_name = mom's first name (used in forever page headline).
      mom_name: contact.mom_name || null,
      delivery_time: contact.delivery_time,
      delivery_timezone: contact.delivery_timezone,
      question_1: answers.question_1,
      question_2: answers.question_2,
      question_3: answers.question_3,
      question_4: answers.question_4,
      messages: { day_1: messages.day_1, day_2: messages.day_2, day_3: messages.day_3 },
      media,
      // Stash language + nickname in forever_data — no schema migration needed.
      // mom_nickname = what the user calls her ("Mama", "Ma", etc.); used in messages.
      forever_data: {
        ...foreverData,
        language,
        mom_nickname: contact.mom_nickname || undefined,
      },
      amount_paid: amountCents,
      paid: isFree,
    };

    // Try with language + delivery_mode first. On Postgres 42703 (undefined
    // column), retry without delivery_mode, then without language.
    let orderRow: { id: string } | null = null;
    let insertError: { message?: string; code?: string } | null = null;
    {
      const r = await supabaseAdmin
        .from('orders')
        .insert({ ...baseRow, language, delivery_mode: deliveryMode })
        .select('id')
        .single();
      orderRow = r.data;
      insertError = r.error;
    }
    if (insertError && (insertError.code === '42703' || /column .*delivery_mode/i.test(insertError.message || ''))) {
      console.warn('orders.delivery_mode column missing — retrying without it');
      const r = await supabaseAdmin
        .from('orders')
        .insert({ ...baseRow, language })
        .select('id')
        .single();
      orderRow = r.data;
      insertError = r.error;
    }
    if (insertError && (insertError.code === '42703' || /column .*language/i.test(insertError.message || ''))) {
      console.warn('orders.language column missing — retrying insert without it');
      const r = await supabaseAdmin.from('orders').insert(baseRow).select('id').single();
      orderRow = r.data;
      insertError = r.error;
    }
    if (insertError || !orderRow) {
      console.error('order insert failed', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'failed to create order' },
        { status: 500 },
      );
    }

    if (!isFree) {
      // Paid path: hand off to Stripe. Webhook will mark paid + schedule emails.
      const session = await createCheckoutSession({
        orderId: orderRow.id,
        amountCents,
        email: contact.user_email,
      });
      await supabaseAdmin
        .from('orders')
        .update({ stripe_session_id: session.id })
        .eq('id', orderRow.id);
      return NextResponse.json({ url: session.url, orderId: orderRow.id });
    }

    // Free path: mark paid, schedule emails directly via the shared scheduler
    // (which threads orderId+emailType through to sendEmail so the gate fires).
    const orderForScheduler = {
      id: orderRow.id,
      user_email: contact.user_email,
      user_name: contact.user_name || null,
      delivery_time: contact.delivery_time,
      delivery_timezone: contact.delivery_timezone,
      mom_name: contact.mom_name || null,
      mom_email: contact.mom_email || null,
      delivery_mode: deliveryMode,
      messages: { day_1: messages.day_1, day_2: messages.day_2, day_3: messages.day_3 },
      media,
    };
    const { scheduledIds, failures } = await scheduleDailyEmails(orderForScheduler);
    if (failures.length) {
      console.warn('free-path schedule failures', { orderId: orderRow.id, failures });
    }

    // Send confirmation immediately (also gated).
    const editToken = signEditToken(orderRow.id);
    const editUrl = `${process.env.NEXT_PUBLIC_URL}/edit/${orderRow.id}#t=${editToken}`;
    const firstSendISO = deliveryISOForDay(1, contact.delivery_time, contact.delivery_timezone);
    const firstSendPretty = formatHumanDate(firstSendISO, contact.delivery_timezone);
    const landingUrl = process.env.NEXT_PUBLIC_URL || '';
    const contributeUrl = `${landingUrl}/success?orderId=${orderRow.id}#contribute`;
    const conf = confirmationEmail({
      orderId: orderRow.id,
      momName: contact.mom_name || undefined,
      editUrl,
      firstSendDate: `${firstSendPretty} at ${formatTime12(contact.delivery_time)}`,
      isFree: true,
      landingUrl,
      contributeUrl,
      deliveryMode,
    });
    const confRes = await sendEmail({
      to: contact.user_email,
      subject: conf.subject,
      html: conf.html,
      tag: 'confirmation',
      orderId: orderRow.id,
      emailType: 'confirmation',
    });
    if (confRes.ok) scheduledIds['confirmation'] = confRes.id;

    await supabaseAdmin
      .from('orders')
      .update({ scheduled_email_ids: scheduledIds })
      .eq('id', orderRow.id);

    // Warm forever page (everyone now). Fire-and-forget.
    void fetch(`${process.env.NEXT_PUBLIC_URL}/api/warm-forever-page`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: orderRow.id }),
    }).catch((e) => {
      console.warn('warm-forever-page kickoff failed', e);
    });

    const successUrl = `${process.env.NEXT_PUBLIC_URL}/success?orderId=${orderRow.id}`;
    return NextResponse.json({ url: successUrl, orderId: orderRow.id });
  } catch (e) {
    console.error('create-checkout error', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function isEmail(s: unknown) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
