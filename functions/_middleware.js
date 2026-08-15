import { verifySessionToken, SESSION_COOKIE } from './_lib/session.js';

const PROTECTED_PATHS = new Set(['/admin-dashboard', '/admin-dashboard.html', '/admin-dashboard/']);

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (!PROTECTED_PATHS.has(url.pathname)) {
    return next();
  }

  const secret = env.SESSION_SECRET;
  const token = getCookie(request, SESSION_COOKIE);
  const username = secret ? await verifySessionToken(token, secret) : null;

  if (!username) {
    return Response.redirect(new URL('/admin', url), 302);
  }

  return next();
}
