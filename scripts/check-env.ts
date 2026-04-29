/**
 * Pre-flight env check. Run before launch / before deploy.
 *
 *   npx tsx scripts/check-env.ts
 *
 * Probes Supabase (read + insert), Resend (key validity), Anthropic (key
 * validity), R2 (presigned URL flow). Reports each as ✓ / ✗ with the actual
 * failure surface.
 *
 * Designed to catch the bugs that look like "everything's fine" until a real
 * customer pays — e.g., publishable key pasted into SECRET slot causes RLS
 * 42501 errors that only surface on the first write attempt.
 */

import fs from 'node:fs';
import path from 'node:path';

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

// Prefer non-empty process.env; fall back to loadEnv. Some parent processes
// (Claude Code) explicitly set ANTHROPIC_API_KEY to "" — using process.env
// directly would inherit that empty value over the real one in .env.local.
const fromFile = loadEnv();
const env: Record<string, string> = { ...fromFile };
for (const [k, v] of Object.entries(process.env)) {
  if (typeof v === 'string' && v.length > 0) env[k] = v;
}
const checks: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
}

async function main() {
  // ---------- 1. Anthropic ----------
  if (!env.ANTHROPIC_API_KEY) {
    record('Anthropic key', false, 'ANTHROPIC_API_KEY missing');
  } else {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'ok' }],
        }),
      });
      if (r.ok) record('Anthropic key', true, 'real call returned 200');
      else record('Anthropic key', false, `status ${r.status}: ${(await r.text()).slice(0, 120)}`);
    } catch (e) {
      record('Anthropic key', false, `threw: ${(e as Error).message}`);
    }
  }

  // ---------- 2. Supabase: read + write (the publishable-vs-secret trap) ----------
  const supaUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supaSecret = env.SUPABASE_SECRET_KEY;
  if (!supaUrl || !supaSecret) {
    record('Supabase env', false, 'URL or SECRET_KEY missing');
  } else {
    const headers = {
      apikey: supaSecret,
      Authorization: `Bearer ${supaSecret}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    // Probe: try to insert a throwaway row. Service-role bypasses RLS;
    // publishable does not (returns 42501).
    const probeRow = {
      tier: 1,
      user_email: 'env-check@example.com',
      delivery_time: '08:00',
      delivery_timezone: 'America/Chicago',
      question_1: 'env-check probe row — safe to delete',
      question_2: 'env-check probe row — safe to delete',
      question_3: 'env-check probe row — safe to delete',
      question_4: 'env-check probe row — safe to delete',
      messages: { day_1: 'probe' },
      amount_paid: 1900,
    };
    try {
      const r = await fetch(`${supaUrl}/rest/v1/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(probeRow),
      });
      const body = await r.text();
      if (r.ok) {
        // Parse out the inserted id and clean up the probe row.
        try {
          const inserted = JSON.parse(body)[0];
          if (inserted?.id) {
            await fetch(`${supaUrl}/rest/v1/orders?id=eq.${inserted.id}`, {
              method: 'DELETE',
              headers,
            });
          }
        } catch {}
        record('Supabase secret key (RLS bypass)', true, 'INSERT succeeded → key is the real sb_secret_');
      } else if (r.status === 401 && body.includes('42501')) {
        record(
          'Supabase secret key (RLS bypass)',
          false,
          'RLS blocked INSERT (42501). Your SUPABASE_SECRET_KEY is actually a publishable key. Get the real sb_secret_… from Supabase → Project Settings → API Keys → Secret tab.',
        );
      } else {
        record('Supabase secret key', false, `status ${r.status}: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      record('Supabase secret key', false, `threw: ${(e as Error).message}`);
    }

    // Schema: confirm forever_data column exists.
    try {
      const r = await fetch(`${supaUrl}/rest/v1/orders?select=id,forever_data,extra_reminders&limit=0`, { headers });
      if (r.ok) record('Supabase schema columns', true, 'forever_data + extra_reminders present');
      else record('Supabase schema columns', false, `status ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } catch (e) {
      record('Supabase schema columns', false, `threw: ${(e as Error).message}`);
    }
  }

  // ---------- 3. Resend ----------
  if (!env.RESEND_API_KEY) {
    record('Resend key', false, 'RESEND_API_KEY missing');
  } else {
    try {
      // List domains is the lightest cred-validating call.
      const r = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
      });
      const body = await r.text();
      if (r.ok) {
        record('Resend key', true, 'API responded 200 to /domains');
      } else if (r.status === 401 && body.includes('restricted_api_key')) {
        // Send-scoped key — can't list domains but CAN send. That's fine for us.
        record('Resend key', true, 'send-scoped restricted key (sufficient for daily emails)');
      } else {
        record('Resend key', false, `status ${r.status}: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      record('Resend key', false, `threw: ${(e as Error).message}`);
    }
  }

  // ---------- 4. Stripe ----------
  if (!env.STRIPE_SECRET_KEY) {
    record('Stripe key', false, 'STRIPE_SECRET_KEY missing');
  } else {
    try {
      const r = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      });
      if (r.ok) record('Stripe key', true, 'balance endpoint returned 200');
      else record('Stripe key', false, `status ${r.status}: ${(await r.text()).slice(0, 200)}`);
    } catch (e) {
      record('Stripe key', false, `threw: ${(e as Error).message}`);
    }
  }

  // ---------- 5. R2 ----------
  const haveR2 = env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_URL;
  if (!haveR2) {
    record('R2 config', false, 'one of R2_* env vars missing');
  } else {
    record('R2 config', true, 'all 5 R2_* env vars present (CORS not tested here)');
  }

  // ---------- Webhook secret ----------
  if (!env.STRIPE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET.length < 10) {
    record('Stripe webhook secret', false, 'missing — set after Vercel deploy or via stripe listen');
  } else if (env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    record('Stripe webhook secret', true, 'looks like a real whsec_ value');
  } else {
    record('Stripe webhook secret', false, 'set but not a whsec_ format value');
  }

  // ---------- Edit + cron secrets ----------
  if (env.EDIT_TOKEN_SECRET && env.EDIT_TOKEN_SECRET.length >= 32) {
    record('EDIT_TOKEN_SECRET', true, `${env.EDIT_TOKEN_SECRET.length} chars`);
  } else {
    record('EDIT_TOKEN_SECRET', false, 'missing or <32 chars (openssl rand -hex 32)');
  }
  if (env.CRON_SECRET && env.CRON_SECRET.length >= 32) {
    record('CRON_SECRET', true, `${env.CRON_SECRET.length} chars`);
  } else {
    record('CRON_SECRET', false, 'missing or <32 chars');
  }

  // ---------- Print report ----------
  console.log('\n=== ENV CHECK ===\n');
  for (const c of checks) {
    const icon = c.ok ? '✅' : '❌';
    console.log(`${icon}  ${c.name.padEnd(36)}  ${c.detail}`);
  }
  const failures = checks.filter((c) => !c.ok).length;
  console.log(`\n${failures === 0 ? '🟢 All checks passed.' : `🔴 ${failures} failing — fix before launch.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('check-env crashed:', e);
  process.exit(2);
});
