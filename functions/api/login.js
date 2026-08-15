import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../_lib/session.js';
import { verifyPassword } from '../_lib/password.js';

// Valid-format hash of a password nobody has, so lookups for unknown
// usernames still run a verify — keeps response timing from revealing
// which usernames exist.
const DUMMY_HASH =
  'pbkdf2$210000$mGQWUPRiIVvHv31vCCEVlA$tB8u4RSeWzpZwraBFXCCmB4IRfPzrQGkIYJD2kvqYzs';

function getUsers(env) {
  try {
    const parsed = JSON.parse(env.ADMIN_USERS || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { username, password } = body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return Response.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const users = getUsers(env);
  const normalizedUsername = username.trim().toLowerCase();
  const user = users.find((u) => u && u.username === normalizedUsername);

  const ok = await verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !ok) {
    return Response.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const secret = env.SESSION_SECRET;
  if (!secret) {
    return Response.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const token = await createSessionToken(user.username, secret);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
    },
  });
}

export async function onRequestGet() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
