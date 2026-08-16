export async function onRequestGet(context) {
  const user = context.data.user;
  return Response.json({ username: user.username, firstName: user.firstName });
}

export async function onRequestPost() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
}
