import { next } from '@vercel/edge';

export const config = {
  matcher: ['/admin-dashboard'],
};

const SESSION_COOKIE = 'fortera_session';

function base64urlToBytes(b64url) {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifySessionToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlToBytes(sigB64),
      new TextEncoder().encode(payloadB64)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload.u;
  } catch {
    return null;
  }
}

export default async function middleware(request) {
  const secret = process.env.SESSION_SECRET;
  const token = getCookie(request, SESSION_COOKIE);
  const username = secret ? await verifySessionToken(token, secret) : null;

  if (!username) {
    return Response.redirect(new URL('/admin', request.url));
  }

  return next();
}
