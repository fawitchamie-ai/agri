import { env } from 'cloudflare:workers';
export function database(): D1Database { const db = (env as unknown as {
    DB?: D1Database;
}).DB; if (!db)
    throw new Error('Base de données indisponible. Veuillez réessayer.'); return db; }
export function json(data: unknown, status = 200, extra: HeadersInit = {}): Response { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } }); }
export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export async function body(request: Request, maxBytes=2000000): Promise<Record<string, any>> { if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'Envoyez un document JSON.'); const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, 'Origine de la requête refusée.'); if (Number(request.headers.get('content-length') || 0) > maxBytes)
    throw new HttpError(413, `Fichier trop volumineux (${maxBytes/1000000} Mo maximum).`); const text = await request.text(); if (new TextEncoder().encode(text).byteLength > maxBytes)
    throw new HttpError(413, `Fichier trop volumineux (${maxBytes/1000000} Mo maximum).`); let value; try {
    value = JSON.parse(text);
}
catch {
    throw new HttpError(400, 'Document JSON illisible.');
} if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Document JSON attendu.'); return value; }
export class ServiceStageError extends Error {
 constructor(public stage:'terrain'|'point-sol'|'sol-meteo',public original:unknown){super('Acquisition interrompue à l’étape '+stage);this.name='ServiceStageError';}
}
export function failure(error: unknown): Response {
 if(error instanceof HttpError)return json({error:error.message},error.status);
 const requestId=crypto.randomUUID();
 const stage=error instanceof ServiceStageError?error.stage:undefined,original=error instanceof ServiceStageError?error.original:error;
 console.error('AgriPrévision request failed',requestId,stage??'unknown',original instanceof Error?original.name:'unknown',original instanceof Error?original.stack?.split('\n').slice(1,8).join('\n'):'');
 return json({error:`${stage?'La récupération des données ('+stage+')':'Le service'} est momentanément indisponible. Vos saisies sont conservées ; réessayez. Référence : ${requestId}.`,requestId,...(stage?{stage}:{})},503,{'X-Request-Id':requestId});
}
export async function digest(s: string): Promise<string> { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
