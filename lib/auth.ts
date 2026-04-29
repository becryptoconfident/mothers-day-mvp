// HMAC-signed magic-link tokens for the /edit dashboard. No password, no
// sessions — the user clicks a one-hour link from their email.

import crypto from 'node:crypto';

const SECRET = process.env.EDIT_TOKEN_SECRET || '';
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

/** Returns "<orderId>.<expiresMs>.<sig>" */
export function signEditToken(orderId: string): string {
  if (!SECRET) throw new Error('EDIT_TOKEN_SECRET not set');
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${orderId}.${expires}`;
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyEditToken(token: string): { ok: true; orderId: string } | { ok: false; reason: string } {
  if (!SECRET) return { ok: false, reason: 'server misconfigured' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'bad format' };
  const [orderId, expiresStr, sig] = parts;
  const payload = `${orderId}.${expiresStr}`;
  const expectedSig = b64url(crypto.createHmac('sha256', SECRET).update(payload).digest());
  const a = fromB64url(sig);
  const b = fromB64url(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad signature' };
  }
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, orderId };
}

export function authorizeCron(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}
