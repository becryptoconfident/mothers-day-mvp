/**
 * Add the 3 Resend DNS records to memphiscarter.com via Namecheap API.
 *
 *   npx tsx scripts/namecheap-add-resend.ts
 *
 * Prereqs (one-time setup, none of which has an API):
 *   1. Namecheap → Profile → Tools → API Access → ENABLE
 *   2. Add your current IP to the whitelist (also on that page)
 *   3. Generate an API key
 *   4. Paste these into Secrets UI as new keys:
 *        NAMECHEAP_API_USER  (your Namecheap username)
 *        NAMECHEAP_API_KEY   (the generated key)
 *
 * What this script does:
 *   1. getHosts → fetches your existing records (so we don't nuke them — setHosts
 *      replaces everything in one call, so we MUST preserve what's there)
 *   2. Adds the 3 Resend records (skipping any that already exist by exact match)
 *   3. setHosts → writes the combined list back
 *
 * Safe to re-run: idempotent. If a record already exists, it's not duplicated.
 */

import fs from 'node:fs';
import path from 'node:path';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const text = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {}
  return out;
}

const env = loadEnv();
const API_USER = env.NAMECHEAP_API_USER;
const API_KEY = env.NAMECHEAP_API_KEY;
const SLD = 'memphiscarter';
const TLD = 'com';

if (!API_USER || !API_KEY) {
  console.error('❌ NAMECHEAP_API_USER and NAMECHEAP_API_KEY must be set in .env.local');
  console.error('   Enable API: namecheap.com → Profile → Tools → API Access');
  process.exit(1);
}

const NEW_RECORDS = [
  {
    HostName: 'resend._domainkey',
    RecordType: 'TXT',
    Address: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDaounmKhJps5q2c9PBbQoOR9OtnQsZO3UVO9jdpTZrvGmZvx1mup9xdbwaaxSO4tcwWezwbctB919pTUwEm2fPiJJvNAWEyqIrSU4rAyRYyAdqAp9Bf6dlCThWtQq926alaWMzIRXRif6HJWPrMNqUwYZc4usswgWVIhDed3PcXQIDAQAB',
    TTL: '1800',
  },
  {
    HostName: 'send',
    RecordType: 'MX',
    Address: 'feedback-smtp.us-east-1.amazonses.com',
    MXPref: '10',
    TTL: '1800',
  },
  {
    HostName: 'send',
    RecordType: 'TXT',
    Address: 'v=spf1 include:amazonses.com ~all',
    TTL: '1800',
  },
];

async function getCurrentPublicIP(): Promise<string> {
  return (await fetch('https://api.ipify.org').then(r => r.text())).trim();
}

async function callNamecheap(command: string, extraParams: Record<string, string>): Promise<string> {
  const ip = await getCurrentPublicIP();
  const params = new URLSearchParams({
    ApiUser: API_USER!,
    ApiKey: API_KEY!,
    UserName: API_USER!,
    Command: command,
    ClientIp: ip,
    ...extraParams,
  });
  const url = `https://api.namecheap.com/xml.response?${params.toString()}`;
  const r = await fetch(url);
  return await r.text();
}

function parseHostsXml(xml: string): Array<Record<string, string>> {
  // Quick & dirty XML parse — Namecheap's response is regular and small.
  const out: Array<Record<string, string>> = [];
  const matches = xml.matchAll(/<host\b([^/]*)\/>/g);
  for (const m of matches) {
    const attrs: Record<string, string> = {};
    const attrPattern = /(\w+)="([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrPattern.exec(m[1])) !== null) {
      attrs[am[1]] = am[2];
    }
    out.push(attrs);
  }
  return out;
}

function fmtRecord(r: Record<string, string>): string {
  return `${r.Type || r.RecordType}|${r.Name || r.HostName}|${r.Address}|${r.MXPref || ''}`;
}

(async () => {
  console.log('Fetching current DNS records for', `${SLD}.${TLD}`);
  const getXml = await callNamecheap('namecheap.domains.dns.getHosts', { SLD, TLD });
  if (getXml.includes('Status="ERROR"') || getXml.includes('IsError="true"')) {
    console.error('❌ getHosts failed:');
    console.error(getXml.slice(0, 1500));
    process.exit(1);
  }
  const existing = parseHostsXml(getXml);
  console.log(`Found ${existing.length} existing record(s):`);
  for (const r of existing) {
    console.log(`  ${r.Type} ${r.Name} → ${(r.Address || '').slice(0, 50)}${(r.Address || '').length > 50 ? '...' : ''}`);
  }

  // Build the merged list. Preserve everything existing; add new ones if not already present.
  const combined = [...existing];
  let added = 0;
  for (const newRec of NEW_RECORDS) {
    const dup = existing.find(e =>
      (e.Type || '') === newRec.RecordType &&
      (e.Name || '') === newRec.HostName &&
      (e.Address || '').trim() === newRec.Address.trim()
    );
    if (dup) {
      console.log(`  ⏭  ${newRec.RecordType} ${newRec.HostName} already exists — skipping`);
    } else {
      combined.push({
        Type: newRec.RecordType,
        Name: newRec.HostName,
        Address: newRec.Address,
        MXPref: newRec.MXPref || '10',
        TTL: newRec.TTL,
      });
      added++;
      console.log(`  +  ${newRec.RecordType} ${newRec.HostName}`);
    }
  }

  if (added === 0) {
    console.log('Nothing to add. Done.');
    return;
  }

  // Build the setHosts params with HostName1, RecordType1, Address1, MXPref1, TTL1, HostName2, ...
  const setParams: Record<string, string> = { SLD, TLD };
  combined.forEach((r, i) => {
    const n = i + 1;
    setParams[`HostName${n}`] = r.Name || '';
    setParams[`RecordType${n}`] = r.Type || '';
    setParams[`Address${n}`] = r.Address || '';
    setParams[`MXPref${n}`] = r.MXPref || '10';
    setParams[`TTL${n}`] = r.TTL || '1800';
  });

  console.log(`\nWriting ${combined.length} record(s) (${existing.length} existing + ${added} new)...`);
  const setXml = await callNamecheap('namecheap.domains.dns.setHosts', setParams);
  if (setXml.includes('Status="ERROR"') || setXml.includes('IsError="true"')) {
    console.error('❌ setHosts failed:');
    console.error(setXml.slice(0, 1500));
    process.exit(1);
  }
  console.log('✅ DNS records written. Wait 5–30 minutes for Resend to detect them.');
  console.log('   I\'ll poll Resend automatically — tell me to start.');
})();
