// Fire-and-forget warm-up for the Forever Page. Called from the Stripe
// webhook on tier 3 payments so by the time mom opens her email link on
// May 10th, the cleaned text + AI letter are already cached in DB.
//
// Idempotent: if cache already exists, returns immediately without re-spending
// Anthropic tokens.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cleanUserTextBatch } from '@/lib/text-cleaner';
import { generateForeverLetter } from '@/lib/forever-letter';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds — enough for cleaning + letter on first run

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id,tier,paid,user_name,mom_name,question_1,question_2,question_3,question_4,forever_data')
      .eq('id', orderId)
      .maybeSingle();
    if (error || !order) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (!order.paid || order.tier !== 3) {
      return NextResponse.json({ ok: true, skipped: 'not paid tier-3' });
    }

    const fd = order.forever_data || {};
    if (fd.cleaned_answers && fd.generated_letter) {
      return NextResponse.json({ ok: true, cached: true });
    }

    const cleaned = fd.cleaned_answers || (await cleanThenSplit(order));
    const letter =
      fd.generated_letter ||
      (await generateForeverLetter({
        cleanedAnswers: cleaned,
        longNote: fd.long_note,
        userName: order.user_name || undefined,
        momName: order.mom_name || undefined,
      }));

    await supabaseAdmin
      .from('orders')
      .update({
        forever_data: { ...fd, cleaned_answers: cleaned, generated_letter: letter },
      })
      .eq('id', order.id);

    return NextResponse.json({ ok: true, generated: true });
  } catch (e) {
    console.error('warm-forever-page error', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function cleanThenSplit(order: {
  question_1: string;
  question_2: string;
  question_3: string;
  question_4: string;
}) {
  const [q1, q2, q3, q4] = await cleanUserTextBatch([
    order.question_1,
    order.question_2,
    order.question_3,
    order.question_4,
  ]);
  return { question_1: q1, question_2: q2, question_3: q3, question_4: q4 };
}
