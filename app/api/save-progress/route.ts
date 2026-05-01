// Pre-payment "save my work" endpoint. Creates a draft orders row (paid=false,
// no Stripe session) so the user can leave and come back to /preview from any
// device via /resume/[orderId]. Sends a "your workspace" email.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { saveProgressEmail } from '@/lib/email-templates';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const contact = body.contact || {};
    const answers = body.answers || {};
    const messages = body.messages || {};
    const media = Array.isArray(body.media) ? body.media : [];
    const foreverData = body.forever_data || {};
    const language = typeof body.language === 'string' ? body.language : 'English';
    const targetEmail = String(body.email || contact.user_email || '').trim();

    if (!isEmail(targetEmail)) {
      return NextResponse.json({ error: 'valid email required' }, { status: 400 });
    }
    for (const k of ['question_1', 'question_2', 'question_3', 'question_4']) {
      if (typeof answers[k] !== 'string' || answers[k].trim().length < 20) {
        return NextResponse.json({ error: `${k} missing or too short` }, { status: 400 });
      }
    }

    // We stash the not-yet-paid /preview state in forever_data.draft_state so
    // /resume/[orderId] can rebuild localStorage on the way back.
    const draftState = {
      answers,
      contact: { ...contact, user_email: targetEmail, delivery_timezone: contact.delivery_timezone || 'America/Chicago', delivery_time: contact.delivery_time || '09:00' },
      language,
      previewMessages: messages,
      previewMedia: media,
      foreverData,
    };

    const baseRow = {
      tier: 3,
      user_email: targetEmail,
      user_name: contact.user_name || null,
      mom_email: contact.mom_email || null,
      mom_name: contact.mom_name || null,
      delivery_time: contact.delivery_time || '09:00',
      delivery_timezone: contact.delivery_timezone || 'America/Chicago',
      question_1: answers.question_1,
      question_2: answers.question_2,
      question_3: answers.question_3,
      question_4: answers.question_4,
      messages: messages && Object.keys(messages).length ? messages : { day_1: '', day_2: '', day_3: '' },
      media,
      forever_data: { ...foreverData, draft_state: draftState, language },
      amount_paid: 0,
    };

    // Try with the language column first; fall back if column doesn't exist.
    let orderRow: { id: string } | null = null;
    let insertError: { message?: string; code?: string } | null = null;
    {
      const r = await supabaseAdmin
        .from('orders')
        .insert({ ...baseRow, language })
        .select('id')
        .single();
      orderRow = r.data;
      insertError = r.error;
    }
    if (insertError && (insertError.code === '42703' || /column .*language/i.test(insertError.message || ''))) {
      const r = await supabaseAdmin.from('orders').insert(baseRow).select('id').single();
      orderRow = r.data;
      insertError = r.error;
    }
    if (insertError || !orderRow) {
      console.error('save-progress insert failed', insertError);
      return NextResponse.json({ error: insertError?.message || 'save failed' }, { status: 500 });
    }

    const resumeUrl = `${process.env.NEXT_PUBLIC_URL}/resume/${orderRow.id}`;
    const tpl = saveProgressEmail({
      resumeUrl,
      momName: contact.mom_name || undefined,
    });
    const r = await sendEmail({
      to: targetEmail,
      subject: tpl.subject,
      html: tpl.html,
      tag: 'save-progress',
    });

    return NextResponse.json({ ok: true, orderId: orderRow.id, emailSent: r.ok });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function isEmail(s: unknown): s is string {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
