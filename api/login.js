const bcrypt = require('bcryptjs');
const { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } = require('../lib/session');

// Valid-format bcrypt hash of a password nobody has, so lookups for unknown
// usernames still run a compare — keeps response timing from revealing
// which usernames exist.
const DUMMY_HASH = '$2a$12$8wkupYQUsMxsTRgaaCZdl.QoLB3qeD6ZVqlatjPpgijuNEDCMWS/u';

function getUsers() {
  try {
    const parsed = JSON.parse(process.env.ADMIN_USERS || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const users = getUsers();
  const normalizedUsername = username.trim().toLowerCase();
  const user = users.find((u) => u && u.username === normalizedUsername);

  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !ok) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('SESSION_SECRET is not configured.');
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const token = createSessionToken(user.username, secret);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
  );
  return res.status(200).json({ ok: true });
};
