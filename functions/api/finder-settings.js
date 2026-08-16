import { badRequest } from '../_lib/http.js';
import { FINDER_SETTINGS_FIELDS } from '../_lib/finder-settings-defaults.js';

async function getSettingsRow(env) {
  let row = await env.DB.prepare('SELECT * FROM finder_settings WHERE id = 1').first();
  if (!row) {
    await env.DB.prepare('INSERT OR IGNORE INTO finder_settings (id) VALUES (1)').run();
    row = await env.DB.prepare('SELECT * FROM finder_settings WHERE id = 1').first();
  }
  return row;
}

export async function onRequestGet(context) {
  const settings = await getSettingsRow(context.env);
  return Response.json({ settings });
}

export async function onRequestPut(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const updates = [];
  const values = [];
  for (const field of FINDER_SETTINGS_FIELDS) {
    if (body[field] === undefined) continue;
    const num = Number(body[field]);
    if (!Number.isFinite(num) || num < 0) return badRequest(`Invalid value for ${field}.`);
    updates.push(`${field} = ?`);
    values.push(num);
  }
  if (!updates.length) return badRequest('No fields to update.');
  updates.push("updated_at = datetime('now')");

  await getSettingsRow(env);
  const row = await env.DB.prepare(`UPDATE finder_settings SET ${updates.join(', ')} WHERE id = 1 RETURNING *`)
    .bind(...values)
    .first();

  return Response.json({ settings: row });
}
