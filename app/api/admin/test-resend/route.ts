// Stateless Resend probe. Sends one test email so we can confirm
// RESEND_API_KEY is wired correctly after a key rotation. No DB writes,
// no scheduling, no dedup — pure pass-through to Resend.
//
// GET /api/admin/test-resend?to=email@example.com
// Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>

import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/resend';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAuthorized(req: Request, secretParam: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${expected}`) return true;
  if (secretParam && secretParam === expected) return true;
  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');

  if (!isAuthorized(req, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const to = url.searchParams.get('to');
  if (!to) {
    return NextResponse.json({ error: 'missing required query param: to' }, { status: 400 });
  }
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: `invalid email: ${to}` }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const subject = `Resend self-test — ${timestamp}`;
  const text = `If you received this, RESEND_API_KEY is working. Sent at ${timestamp}.`;
  // sendEmail wants HTML; wrap the plain text minimally so it renders as-is.
  const html = `<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;font-size:14px;color:#111;"><p>${text}</p></body></html>`;

  const result = await sendEmail({
    to,
    subject,
    html,
    tag: 'admin-test-resend',
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id, to });
}
