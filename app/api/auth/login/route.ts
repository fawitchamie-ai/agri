import { currentAccessIdentity, safeAccessReturnPath } from '@/lib/cloudflare-access';

export async function GET(request: Request) {
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
  if (currentAccessIdentity()) {
    const requestUrl = new URL(request.url);
    headers.set('Location', safeAccessReturnPath(requestUrl.searchParams.get('returnTo')));
    return new Response(null, { status: 302, headers });
  }

  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(`<!doctype html>
<html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion indisponible · AgriPrévision</title>
<main><h1>La connexion n’a pas abouti</h1>
<p>Cloudflare Access n’a pas transmis de session à AgriPrévision.</p>
<a href="/field-workspace/">Retour à Mes champs</a></main></html>`, { status: 503, headers });
}
