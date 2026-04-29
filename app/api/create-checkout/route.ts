import { NextResponse } from 'next/server';
import { createCheckoutSession, type Tier } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tier = clampTier(body.tier);
    const contact = body.contact || {};
    const answers = body.answers || {};
    const messages = body.messages;
    const media = Array.isArray(body.media) ? body.media : [];
    // Tier 3 forever-page extras
    const foreverData = body.forever_data || {};

    // Buyer-relay model: mom_email is optional (buyer texts mom from their phone).
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
    // Soft gate: user sees + edits Days 1 and 2 before paying. Days 3-7 are
    // generated server-side by the Stripe webhook after payment.
    if (!messages || typeof messages !== 'object') {
      return NextResponse.json({ error: 'missing messages' }, { status: 400 });
    }
    if (typeof messages.day_1 !== 'string' || !messages.day_1.trim()) {
      return NextResponse.json({ error: 'messages.day_1 missing' }, { status: 400 });
    }
    if (typeof messages.day_2 !== 'string' || !messages.day_2.trim()) {
      return NextResponse.json({ error: 'messages.day_2 missing' }, { status: 400 });
    }
    const requiredAnswers = ['question_1', 'question_2', 'question_3', 'question_4'];
    for (const k of requiredAnswers) {
      if (typeof answers[k] !== 'string' || answers[k].trim().length < 20) {
        return NextResponse.json({ error: `${k} missing or too short` }, { status: 400 });
      }
    }

    const tierAmount = tier === 1 ? 1900 : tier === 2 ? 2900 : 4900;

    const { data: orderRow, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert({
        tier,
        user_email: contact.user_email,
        user_name: contact.user_name || null,
        mom_email: contact.mom_email || null,
        mom_name: contact.mom_name || null,
        delivery_time: contact.delivery_time,
        delivery_timezone: contact.delivery_timezone,
        extra_reminders: !!body.extra_reminders,
        question_1: answers.question_1 || '',
        question_2: answers.question_2 || '',
        question_3: answers.question_3 || '',
        question_4: answers.question_4 || '',
        messages,
        media,
        forever_data: tier === 3 ? foreverData : {},
        amount_paid: tierAmount,
      })
      .select('id')
      .single();

    if (insertError || !orderRow) {
      console.error('order insert failed', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'failed to create order' },
        { status: 500 },
      );
    }

    const session = await createCheckoutSession({
      orderId: orderRow.id,
      tier,
      email: contact.user_email,
    });

    await supabaseAdmin
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', orderRow.id);

    return NextResponse.json({ url: session.url, orderId: orderRow.id });
  } catch (e) {
    console.error('create-checkout error', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function clampTier(n: unknown): Tier {
  if (n === 2 || n === '2') return 2;
  if (n === 3 || n === '3') return 3;
  return 1;
}

function isEmail(s: unknown) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
