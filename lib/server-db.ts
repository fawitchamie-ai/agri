import { env } from 'cloudflare:workers';
export function database(): D1Database { const db = (env as unknown as {
    DB?: D1Database;
}).DB; if (!db)
    throw new Error('Base de données indisponible. Veuillez réessayer.'); return db; }
export function json(data: unknown, status = 200, extra: HeadersInit = {}): Response { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } }); }
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export async function body(request: Request): Promise<Record<string, any>> { if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'Envoyez un document JSON.'); const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, 'Origine de la requête refusée.'); if (Number(request.headers.get('content-length') || 0) > 2000000)
    throw new HttpError(413, 'Fichier trop volumineux (2 Mo maximum).'); const text = await request.text(); if (text.length > 2000000)
    throw new HttpError(413, 'Fichier trop volumineux (2 Mo maximum).'); let value; try {
    value = JSON.parse(text);
}
catch {
    throw new HttpError(400, 'Document JSON illisible.');
} if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Document JSON attendu.'); return value; }
export function failure(error: unknown): Response { if (error instanceof HttpError)
    return json({ error: error.message }, error.status); console.error('AgriPrévision request failed', error instanceof Error ? error.message : 'unknown'); return json({ error: 'Le service est momentanément indisponible. Vos saisies peuvent être réessayées.' }, 503); }
export async function digest(s: string): Promise<string> { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
