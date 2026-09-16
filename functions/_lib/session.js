// Signed session tokens for the management portal.
// Runs on the Workers runtime (Cloudflare Pages Functions), so this uses
// only Web Crypto / Web platform APIs — no Node built-ins.

import { base64urlEncode, base64urlDecode } from './base64url.js';

export const SESSION_COOKIE = 'fortera_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
export const SESSION_TTL_REMEMBER_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(username, firstName, secret, ttlSeconds = SESSION_TTL_SECONDS) {
  const payload = { u: username, n: firstName || null, exp: Date.now() + ttlSeconds * 1000 };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(sig)}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const key = await hmacKey(secret);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(sigB64),
      new TextEncoder().encode(payloadB64)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return { username: payload.u, firstName: payload.n || null };
  } catch {
    return null;
  }
}
