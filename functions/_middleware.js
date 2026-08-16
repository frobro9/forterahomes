import { verifySessionToken, SESSION_COOKIE } from './_lib/session.js';

const PROTECTED_PAGES = new Set(['/admin-dashboard', '/admin-dashboard.html', '/admin-dashboard/']);
const PROTECTED_API_PREFIXES = ['/api/tasks', '/api/events', '/api/me'];

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  const isProtectedPage = PROTECTED_PAGES.has(url.pathname);
  const isProtectedApi = PROTECTED_API_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );

  if (!isProtectedPage && !isProtectedApi) {
    return next();
  }

  const secret = env.SESSION_SECRET;
  const token = getCookie(request, SESSION_COOKIE);
  const session = secret ? await verifySessionToken(token, secret) : null;

  if (!session) {
    if (isProtectedApi) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.redirect(new URL('/admin', url), 302);
  }

  context.data.user = session;
  return next();
}
