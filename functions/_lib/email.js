// Thin wrapper around Resend's REST API — no SDK, just fetch, consistent
// with this project's other Pages Functions. Requires RESEND_API_KEY and
// RESEND_FROM_EMAIL to be set as secrets in the Cloudflare Pages dashboard
// (never checked into the repo — see wrangler.toml). If they're missing,
// send() logs and no-ops rather than throwing, so a missing email config
// never blocks an applicant's status from moving forward.
export async function sendEmail(env, { to, subject, html }) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error('sendEmail skipped: RESEND_API_KEY / RESEND_FROM_EMAIL not configured.');
    return { sent: false };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    console.error('sendEmail failed:', res.status, await res.text().catch(() => ''));
    return { sent: false };
  }

  return { sent: true };
}

function siteUrl(env, path) {
  const base = (env.SITE_BASE_URL || 'https://forterahomes.ca').replace(/\/$/, '');
  return `${base}${path}`;
}

export function sendScreeningInviteEmail(env, applicant, token) {
  const link = siteUrl(env, `/apply.html?token=${encodeURIComponent(token)}`);
  return sendEmail(env, {
    to: applicant.email,
    subject: 'Next step for your Fortera Homes rental application',
    html: `
      <p>Hi ${escapeHtml(applicant.name)},</p>
      <p>Thanks for your interest in Beechwood Collection. We'd like to move forward with your application &mdash; please complete a short screening form so we can review your application:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link is valid for 7 days.</p>
      <p>&mdash; Fortera Homes</p>
    `,
  });
}

export function sendLeaseEmail(env, applicant) {
  return sendEmail(env, {
    to: applicant.email,
    subject: 'Your Fortera Homes lease — next steps',
    html: `
      <p>Hi ${escapeHtml(applicant.name)},</p>
      <p>Congratulations &mdash; we'd like to move forward with your lease at Beechwood Collection. A member of our team will follow up shortly with your lease documents to review and sign.</p>
      <p>&mdash; Fortera Homes</p>
    `,
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
