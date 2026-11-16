// Public contact endpoint for the /register page (Multiplex and Other inquiries).
// Emails each inquiry to Fortera through Resend.
//
// Cloudflare Pages environment variables (set in the dashboard, never in code):
//   RESEND_API_KEY  required: Resend API key (Encrypt it as a secret)
//   INQUIRY_TO      optional: where inquiries go, comma-separated (default admin@forterahomes.ca)
//   INQUIRY_FROM    optional: sender, e.g. "Fortera Homes <website@forterahomes.ca>". The
//                   domain must be verified in Resend. Until it is, the default
//                   onboarding@resend.dev sender only delivers to the Resend account's own email.

const LIMITS = { name: 120, email: 200, phone: 40, location: 200, land: 60, timeline: 60, message: 5000, inquiry: 60 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // some privacy setups strip Origin on same-site posts
  try {
    const o = new URL(origin).hostname;
    const self = new URL(request.url).hostname;
    return o === self || o === 'forterahomes.ca' || o.endsWith('.forterahomes.ca') || o.endsWith('.pages.dev') || o === 'localhost' || o === '127.0.0.1';
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!allowedOrigin(request)) return Response.json({ error: 'Forbidden.' }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  // Honeypot: real visitors never see or fill this field. Pretend success for bots.
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true });

  const v = {};
  for (const [k, max] of Object.entries(LIMITS)) {
    v[k] = typeof body[k] === 'string' ? body[k].trim().slice(0, max) : '';
  }

  const fields = {};
  if (!v.name) fields.name = 'Please enter your name.';
  if (!EMAIL_RE.test(v.email)) fields.email = 'Please enter a valid email address.';
  if (!v.message) fields.message = 'Please enter a message.';
  if (Object.keys(fields).length) return Response.json({ error: 'Please check the highlighted fields.', fields }, { status: 400 });

  if (!env.RESEND_API_KEY) {
    return Response.json({ error: 'Our contact form is not available right now. Please email us at admin@forterahomes.ca.' }, { status: 503 });
  }

  const kind = v.inquiry || 'Website inquiry';
  const rows = [
    ['Inquiry', kind],
    ['Name', v.name],
    ['Email', v.email],
    ['Phone', v.phone],
    ['Property / area', v.location],
    ['Own the land', v.land],
    ['Timeline', v.timeline],
  ].filter(([, val]) => val);

  const text = rows.map(([k, val]) => `${k}: ${val}`).join('\n') + `\n\n${v.message}\n`;
  const html =
    '<table cellpadding="6" style="border-collapse:collapse;font:14px/1.5 Arial,sans-serif">' +
    rows.map(([k, val]) => `<tr><td style="color:#6b6258;padding-right:16px">${esc(k)}</td><td>${esc(val)}</td></tr>`).join('') +
    `</table><p style="font:14px/1.6 Arial,sans-serif;white-space:pre-wrap;margin-top:16px">${esc(v.message)}</p>`;

  const to = (env.INQUIRY_TO || 'admin@forterahomes.ca').split(',').map((s) => s.trim()).filter(Boolean);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.INQUIRY_FROM || 'Fortera Homes Website <onboarding@resend.dev>',
      to,
      reply_to: v.email,
      subject: `${kind}: ${v.name}`,
      text,
      html,
    }),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return Response.json({ error: 'We could not send your message. Please email us at admin@forterahomes.ca.' }, { status: 502 });
  }
  return Response.json({ ok: true });
}
