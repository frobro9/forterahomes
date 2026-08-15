// Password hashing for the management portal, using PBKDF2 via Web Crypto —
// no npm dependency, since Cloudflare Pages doesn't run `npm install` for
// this project (no build command is configured, and this stays a
// build-step-free static site on purpose).

import { base64urlEncode, base64urlDecode } from './base64url.js';

const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

async function deriveBits(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64urlEncode(salt)}$${base64urlEncode(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1], 10);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  let salt;
  let expectedHash;
  try {
    salt = base64urlDecode(parts[2]);
    expectedHash = base64urlDecode(parts[3]);
  } catch {
    return false;
  }

  const hash = await deriveBits(password, salt, iterations);
  return constantTimeEqual(hash, expectedHash);
}
