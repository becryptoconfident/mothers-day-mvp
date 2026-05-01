/**
 * Verify the reminder-misfire hotfix.
 *
 * Run:  npx tsx scripts/verify-reminder-gate.ts
 *
 * Three checks against live Supabase (no real Resend calls — gate skips first):
 *   1. Refunded test order → skip "order not active"
 *   2. Refunded test order → claim row written with sent_at NULL
 *   3. Active test order with pre-existing claim → skip "already sent"
 *
 * Pre-req: supabase_schema.sql has been applied (sent_emails table exists).
 *
 * Cleans up its own rows on success. On failure, prints what's left to clean.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const text = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {}
  return out;
}

const fileEnv = loadEnv();
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v;
}

// Resend SDK throws on missing key at construction. Use a placeholder so the
// import succeeds; the gate skips both test paths before we'd ever call Resend.
process.env.RESEND_API_KEY = 're_placeholder_for_verify_only';

async function main() {
  const { sendEmail } = await import('../lib/resend');
  const { supabaseAdmin } = await import('../lib/supabase');

  const created: { orderIds: string[]; claims: { order_id: string; email_type: string }[] } = {
    orderIds: [],
    claims: [],
  };

  const baseOrder = (paid: boolean) => ({
    id: randomUUID(),
    tier: 1,
    user_email: 'test+gate@example.invalid',
    delivery_time: '08:00',
    delivery_timezone: 'America/Chicago',
    extra_reminders: false,
    question_1: 'test',
    question_2: 'test',
    question_3: 'test',
    question_4: 'test',
    messages: { day_1: 'test' },
    amount_paid: 1900,
    paid,
  });

  let pass = 0;
  let fail = 0;
  const log = (label: string, ok: boolean, detail: string) => {
    const tag = ok ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${label} — ${detail}`);
    if (ok) pass++;
    else fail++;
  };

  try {
    // Sanity check: sent_emails table exists.
    const probe = await supabaseAdmin.from('sent_emails').select('order_id').limit(1);
    if (probe.error) {
      console.error('[FATAL] sent_emails table not reachable:', probe.error.message);
      console.error('Did you apply supabase_schema.sql to Supabase?');
      process.exit(2);
    }

    // ---- Test 1: refunded order ----
    const refunded = baseOrder(false);
    {
      const { error } = await supabaseAdmin.from('orders').insert(refunded);
      if (error) {
        console.error('[FATAL] could not insert refunded test order:', error.message);
        process.exit(3);
      }
      created.orderIds.push(refunded.id);
    }
    {
      const r = await sendEmail({
        to: refunded.user_email,
        subject: 'gate test — refunded',
        html: '<p>should not send</p>',
        orderId: refunded.id,
        emailType: 'day_1',
      });
      const ok = r.ok === false && r.error === 'skipped: order not active';
      log('refunded → skipped: order not active', ok, `got ${JSON.stringify(r)}`);

      // The claim row should exist (claim happens before re-fetch), with sent_at NULL.
      const { data: row } = await supabaseAdmin
        .from('sent_emails')
        .select('order_id, email_type, sent_at')
        .eq('order_id', refunded.id)
        .eq('email_type', 'day_1')
        .single();
      if (row) created.claims.push({ order_id: row.order_id, email_type: row.email_type });
      log('refunded → claim row written, sent_at NULL', !!row && row.sent_at === null, `row=${JSON.stringify(row)}`);
    }

    // ---- Test 2: already-sent (claim pre-exists) ----
    const active = baseOrder(true);
    {
      const { error } = await supabaseAdmin.from('orders').insert(active);
      if (error) {
        console.error('[FATAL] could not insert active test order:', error.message);
        process.exit(4);
      }
      created.orderIds.push(active.id);
    }
    {
      // Pre-claim
      const { error } = await supabaseAdmin
        .from('sent_emails')
        .insert({ order_id: active.id, email_type: 'day_1', sent_at: new Date().toISOString() });
      if (error) {
        console.error('[FATAL] could not pre-insert claim:', error.message);
        process.exit(5);
      }
      created.claims.push({ order_id: active.id, email_type: 'day_1' });

      const r = await sendEmail({
        to: active.user_email,
        subject: 'gate test — already sent',
        html: '<p>should not send</p>',
        orderId: active.id,
        emailType: 'day_1',
      });
      const ok = r.ok === false && r.error === 'skipped: already sent';
      log('active + pre-claim → skipped: already sent', ok, `got ${JSON.stringify(r)}`);
    }

  } finally {
    // Cleanup
    for (const claim of created.claims) {
      await supabaseAdmin
        .from('sent_emails')
        .delete()
        .eq('order_id', claim.order_id)
        .eq('email_type', claim.email_type);
    }
    for (const id of created.orderIds) {
      await supabaseAdmin.from('orders').delete().eq('id', id);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
