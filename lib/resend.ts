import { Resend } from 'resend';
import { supabaseAdmin } from './supabase';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'Memphis <onboarding@resend.dev>';

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  scheduledAt?: string; // ISO 8601
  replyTo?: string;
  tag?: string;
  // Hotfix gate: when both are provided, sendEmail runs the
  // claim → re-fetch → send-with-Idempotency-Key → confirm pattern.
  // Either alone is ignored (pass-through, preserves magic-link / save-progress).
  orderId?: string;
  emailType?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[resend] RESEND_API_KEY not set — skipping send');
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }

  const gated = !!(args.orderId && args.emailType);

  if (gated) {
    // 1. Claim the slot. PK collision = "already sent" — skip.
    const { error: claimErr } = await supabaseAdmin
      .from('sent_emails')
      .insert({ order_id: args.orderId, email_type: args.emailType });

    if (claimErr) {
      // Postgres unique-violation: 23505. Treat as "already sent."
      const code = (claimErr as { code?: string }).code;
      if (code === '23505') {
        console.log(`[resend] skipped: already sent (${args.emailType}/${args.orderId})`);
        return { ok: false, error: 'skipped: already sent' };
      }
      console.error('[resend] claim insert failed', claimErr);
      return { ok: false, error: `claim failed: ${claimErr.message}` };
    }

    // 2. Re-fetch order. Skip if missing or not paid.
    // Schema currently has no `status` column — `paid !== true` is the only
    // active-state signal. A future Stripe `charge.refunded` handler that
    // flips `paid = false` will be caught by the same gate.
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('paid')
      .eq('id', args.orderId)
      .single();

    if (!order || order.paid !== true) {
      console.log(`[resend] skipped: order not active (${args.emailType}/${args.orderId})`);
      return { ok: false, error: 'skipped: order not active' };
    }
  }

  try {
    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
      replyTo: args.replyTo,
      tags: args.tag ? [{ name: 'category', value: args.tag }] : undefined,
    };
    if (args.scheduledAt) {
      (payload as unknown as Record<string, unknown>).scheduledAt = args.scheduledAt;
    }

    // 3. Hand to Resend. Idempotency-Key dedupes server-side on retry.
    const sendOptions = gated
      ? { idempotencyKey: `${args.emailType}/${args.orderId}` }
      : undefined;
    const { data, error } = await resend.emails.send(payload, sendOptions);
    if (error || !data) return { ok: false, error: error?.message || 'unknown error' };

    // 4. Confirm.
    if (gated) {
      await supabaseAdmin
        .from('sent_emails')
        .update({ sent_at: new Date().toISOString() })
        .eq('order_id', args.orderId!)
        .eq('email_type', args.emailType!);
    }

    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Cancel a previously-scheduled email. Safe to call on already-sent ids — Resend returns an error we swallow. */
export async function cancelEmail(id: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !id) return false;
  try {
    // Resend exposes cancel via emails.cancel(id); fall back to REST DELETE if SDK shape differs.
    type Cancelable = { cancel?: (id: string) => Promise<unknown> };
    const candidate = (resend.emails as unknown as Cancelable).cancel;
    if (typeof candidate === 'function') {
      await candidate.call(resend.emails, id);
      return true;
    }
    const r = await fetch(`https://api.resend.com/emails/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}
