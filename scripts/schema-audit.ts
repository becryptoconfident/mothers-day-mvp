/**
 * Schema audit. Run before any ALTER TABLE work for the rewrite.
 *
 * Run:  npx tsx scripts/schema-audit.ts
 *
 * Prints: actual deployed columns on `orders` (from Supabase REST OpenAPI),
 * plus the four spec checks called out in the unified handoff:
 *   - question_5 exists?
 *   - tier CHECK constraint?
 *   - tier default?
 *   - messages format?
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

const fileEnv = loadEnv();
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Supabase exposes an OpenAPI spec at the REST root that includes column metadata.
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) {
    console.error(`OpenAPI fetch failed: ${r.status} ${r.statusText}`);
    process.exit(2);
  }
  const spec = (await r.json()) as {
    definitions: Record<
      string,
      { properties: Record<string, { type?: string; format?: string; description?: string }>; required?: string[] }
    >;
  };

  const ordersDef = spec.definitions.orders;
  if (!ordersDef) {
    console.error('orders table not found in OpenAPI spec');
    process.exit(3);
  }

  console.log('=== orders columns (live) ===');
  const props = ordersDef.properties;
  const required = new Set(ordersDef.required || []);
  const colNames = Object.keys(props);
  const maxLen = Math.max(...colNames.map((n) => n.length));
  for (const name of colNames) {
    const p = props[name];
    const type = p.format || p.type || '?';
    const req = required.has(name) ? 'NOT NULL' : 'NULL';
    const desc = p.description ? ` -- ${p.description.split('\n')[0]}` : '';
    console.log(`  ${name.padEnd(maxLen)}  ${type.padEnd(20)} ${req}${desc}`);
  }

  console.log('\n=== sent_emails columns (live) ===');
  const sentDef = spec.definitions.sent_emails;
  if (!sentDef) {
    console.log('  (sent_emails not found — was the migration applied?)');
  } else {
    const sProps = sentDef.properties;
    const sReq = new Set(sentDef.required || []);
    const sNames = Object.keys(sProps);
    const sMaxLen = Math.max(...sNames.map((n) => n.length));
    for (const name of sNames) {
      const p = sProps[name];
      const type = p.format || p.type || '?';
      const req = sReq.has(name) ? 'NOT NULL' : 'NULL';
      console.log(`  ${name.padEnd(sMaxLen)}  ${type.padEnd(20)} ${req}`);
    }
  }

  console.log('\n=== handoff checklist ===');
  console.log(`  question_5 exists?      ${'question_5' in props ? 'YES' : 'NO'}`);
  console.log(`  question_4 exists?      ${'question_4' in props ? 'YES' : 'NO'}`);
  console.log(`  tier exists?            ${'tier' in props ? 'YES' : 'NO'}`);
  if ('tier' in props) {
    const tier = props.tier;
    console.log(`    tier description:     ${tier.description || '(none — CHECK / default not visible in OpenAPI)'}`);
  }
  console.log(`  messages exists?        ${'messages' in props ? 'YES' : 'NO'}`);
  console.log(`  amount_paid exists?     ${'amount_paid' in props ? 'YES' : 'NO'}`);
  console.log(`  paid exists?            ${'paid' in props ? 'YES' : 'NO'}`);
  console.log(`  forever_data exists?    ${'forever_data' in props ? 'YES' : 'NO'}`);
  console.log(`  scheduled_email_ids?    ${'scheduled_email_ids' in props ? 'YES' : 'NO'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
