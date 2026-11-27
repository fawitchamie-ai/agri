const WEB_INTERFACE = '/field-workspace/';

/** Keep the legacy React pages unreachable; serve the web-only field interface. */
export function redirectLegacyWebInterface(request: Request): Response | null {
  const url = new URL(request.url);
  const path = url.pathname;
  let target: string | null = null;

  if (path === '/' || path === '/outils' || path.startsWith('/outils/')) {
    target = WEB_INTERFACE;
    url.search = '';
  } else if (path === '/champs' || path === '/champs/') {
    target = WEB_INTERFACE;
  } else if (path.startsWith('/champs/')) {
    target = WEB_INTERFACE + path.slice('/champs/'.length);
  }

  if (!target) return null;
  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD', 'Cache-Control': 'no-store'}});
  }

  url.pathname = target;
  return new Response(null, {
    status: 302,
    headers: {Location: url.toString(), 'Cache-Control': 'private, no-store', 'X-Agri-Interface': 'web-field-workspace'},
  });
}
