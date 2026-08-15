// Signed session tokens for the management portal.
// Runs on the Workers runtime (Cloudflare Pages Functions), so this uses
// only Web Crypto / Web platform APIs — no Node built-ins.

export const SESSION_COOKIE = 'fortera_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function base64urlEncode(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(username, secret) {
  const payload = { u: username, exp: Date.now() + SESSION_TTL_SECONDS * 1000 };
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
    return payload.u;
  } catch {
    return null;
  }
}
