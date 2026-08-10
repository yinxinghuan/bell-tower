const SESSION_ID = '7484763a-965f-46db-9b36-d0c1e352785a';

/** Frontend-only session handler used by the AlterU self-hosted deployer. */
export async function handleApi(request) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname.endsWith('/api/health')) {
    return Response.json({
      ok: true,
      game: 'bell-tower',
      sessionId: SESSION_ID,
      mode: 'frontend-only',
    });
  }
  return new Response('Not Found', { status: 404 });
}
