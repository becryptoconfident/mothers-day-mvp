import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'Memphis <onboarding@resend.dev>';

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  scheduledAt?: string; // ISO 8601
  replyTo?: string;
  tag?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[resend] RESEND_API_KEY not set — skipping send');
    return { ok: false, error: 'RESEND_API_KEY not set' };
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
    const { data, error } = await resend.emails.send(payload);
    if (error || !data) return { ok: false, error: error?.message || 'unknown error' };
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
