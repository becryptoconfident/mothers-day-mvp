/**
 * Manual email confidence test.
 *
 * Run:  npx tsx scripts/send-test-email.ts you@example.com
 *
 * Sends a real Day-1 email to whatever address you pass on the CLI (defaults to
 * SUPPORT_EMAIL). If it lands in your inbox in <60s, Resend is wired correctly
 * and your domain / sender identity / API key all work.
 *
 * This is the ONE thing to run before launch day. If this fails, nothing else
 * matters.
 */

import { Resend } from 'resend';
import fs from 'node:fs';
import path from 'node:path';

// Read .env.local directly — same fallback pattern as lib/anthropic.ts, since
// the CLI process may not have env vars from Next's loader.
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

const env = { ...loadEnv(), ...process.env };
const KEY = env.RESEND_API_KEY;
const FROM = env.RESEND_FROM || 'Memphis <onboarding@resend.dev>';
const FALLBACK_TO = env.SUPPORT_EMAIL || '';
const TO = process.argv[2] || FALLBACK_TO;

if (!KEY) {
  console.error('❌ RESEND_API_KEY missing in .env.local');
  process.exit(1);
}
if (!TO) {
  console.error('❌ Pass an address: npx tsx scripts/send-test-email.ts you@example.com');
  process.exit(1);
}

const html = `
<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 14px 0; margin-bottom: 18px;">
    <div style="color: #15803d; font-size: 13px; font-weight: 500;">✓ This is a TEST email</div>
    <div style="color: #111827; font-size: 15px; font-weight: 600; margin-top: 4px;">→ Day 1 of 7 — copy and text to mom</div>
    <div style="background: #e5e7eb; border-radius: 9999px; height: 5px; margin: 9px 0;">
      <div style="background: #f43f5e; height: 5px; border-radius: 9999px; width: 14%;"></div>
    </div>
    <div style="color: #6b7280; font-size: 12px; font-style: italic;">Next: Day 2 hits your inbox tomorrow morning at 8am.</div>
  </div>
  <p style="font-size: 16px; color: #374151; margin: 0 0 12px;">
    Send this to mom today. Just paste it in a text:
  </p>
  <div style="background: #fff1f2; border-left: 4px solid #f43f5e; padding: 18px 20px; border-radius: 6px;">
    <p style="margin: 0; font-family: Georgia, serif; font-size: 18px; line-height: 1.7;">
      Hey Mom — thinking about how you always make that soup when I'm sick.
      You drove 2 hours to bring it to me in college. I still use the same
      blue tupperware. Just wanted you to know I notice.
    </p>
  </div>
  <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
    Copy it. Paste in a text to mom. Send. Done. Takes 30 seconds.
  </p>
  <p style="font-size: 14px; color: #6b7280; margin-top: 6px;">
    Mom will think you've been planning for a month.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    Test email sent at ${new Date().toISOString()}<br>
    From: ${FROM}<br>
    If you got this, Resend is wired correctly. Ship it.
  </p>
</div>`;

(async () => {
  console.log(`📧 Sending test Day-1 email to ${TO}...`);
  console.log(`   from:   ${FROM}`);
  const t0 = Date.now();
  try {
    const resend = new Resend(KEY);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [TO],
      subject: 'TEST · Day 1 of 7 — Your Message is Ready (30 seconds)',
      html,
    });
    const ms = Date.now() - t0;
    if (error || !data) {
      console.error(`❌ Failed (${ms}ms):`, error?.message || 'no data');
      process.exit(1);
    }
    console.log(`✅ Sent in ${ms}ms`);
    console.log(`   id:     ${data.id}`);
    console.log(`   inbox:  ${TO}`);
    console.log(`   wait:   <60s, then check spam folder if missing`);
  } catch (e) {
    console.error('❌ Threw:', (e as Error).message);
    process.exit(1);
  }
})();
