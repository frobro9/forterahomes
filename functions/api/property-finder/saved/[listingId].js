import { badRequest } from '../../../_lib/http.js';

export async function onRequestDelete(context) {
  const { env, params } = context;
  const listingId = Number(params.listingId);
  if (!Number.isInteger(listingId)) return badRequest('Invalid listingId.');

  await env.DB.prepare('DELETE FROM pf_saved_properties WHERE listing_id = ?').bind(listingId).run();
  return Response.json({ ok: true });
}
