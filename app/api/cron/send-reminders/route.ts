// Hourly cron. Reminders themselves are scheduled via Resend at order time
// (see stripe-webhook). This cron is a safety net that re-sends if the
// Resend-scheduled reminder failed (e.g., key rotated). For MVP, it's a
// no-op stub that returns 200 so Vercel cron stays green.

import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, note: 'reminders handled by Resend scheduledAt' });
}
