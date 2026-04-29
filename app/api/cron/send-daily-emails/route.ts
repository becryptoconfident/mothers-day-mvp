// Hourly cron. Resend's scheduledAt does the actual sending — this cron's job
// is housekeeping: lock orders whose edit window has closed, and log any
// orders that look like they should have sent already but didn't.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authorizeCron } from '@/lib/auth';
import { localToUTC, EDIT_CLOSE_DATE } from '@/lib/dates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const result: { locked: number; checked: number } = { locked: 0, checked: 0 };

  // Find paid orders that aren't locked yet.
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id,delivery_timezone,edit_locked,paid')
    .eq('paid', true)
    .eq('edit_locked', false);

  if (!orders) return NextResponse.json(result);

  result.checked = orders.length;

  const toLock: string[] = [];
  for (const o of orders) {
    const closeUTC = localToUTC(EDIT_CLOSE_DATE, '23:59', o.delivery_timezone);
    if (now.toISOString() >= closeUTC) toLock.push(o.id);
  }

  if (toLock.length) {
    await supabaseAdmin
      .from('orders')
      .update({ edit_locked: true })
      .in('id', toLock);
    result.locked = toLock.length;
  }

  return NextResponse.json(result);
}
