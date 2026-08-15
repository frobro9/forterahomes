export function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound(message = 'Not found.') {
  return Response.json({ error: message }, { status: 404 });
}
