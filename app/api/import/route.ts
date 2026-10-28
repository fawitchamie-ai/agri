import { session } from '@/lib/server-auth';
import { body, database, digest, failure, HttpError, json } from '@/lib/server-db';
import { validateImport, forecastKey, canonicalLevel } from '@/lib/server-import';
import { scienceFor } from '@/lib/server-science';
export async function POST(request: Request) { try {
    const s = await session(request);
    if (s.role !== 'admin')
        throw new HttpError(403, 'L’import scientifique est réservé à l’administrateur.');
    const b = await body(request);
    if (typeof b.csv !== 'string')
        throw new HttpError(400, 'Un fichier CSV est requis.');
    let result;
    try {
        result = validateImport(b.csv);
    }
    catch (e) {
        throw new HttpError(400, e instanceof Error ? e.message : 'CSV invalide.');
    }
    const hash = await digest(b.csv), db = database();
    const existing = await db.prepare('SELECT id FROM scientific_imports WHERE coop_id=? AND hash=?').bind(s.coopId, hash).first();
    const known = await scienceFor(s), warnings: string[] = [];
    const crops = new Set(known.forecasts.map(f => f.crop)), territories = new Set(known.forecasts.map(f => f.territory));
    territories.add('Togo');
    for (const [index, f] of result.preview.entries()) {
        const line = result.lineNumbers[index];
        if (!crops.has(f.crop))
            result.errors.push({ line, message: `Culture inconnue « ${f.crop} ». Utilisez un identifiant du jeu scientifique disponible.` });
        if (!territories.has(f.territory))
            result.errors.push({ line, message: `Territoire inconnu « ${f.territory} ». Aucun rapprochement automatique; intégrez le référentiel avant ces résultats.` });
        const level = canonicalLevel(f.level);
        if (level === 'national' && f.territory !== 'Togo')
            result.errors.push({ line, message: 'Un résultat national doit porter sur le territoire Togo.' });
        if (level === 'prefecture_historique' && !known.forecasts.some(k => k.territory === f.territory && canonicalLevel(k.level) === 'prefecture_historique'))
            result.errors.push({ line, message: 'Ce territoire n’appartient pas au référentiel des préfectures historiques disponibles.' });
        if (level === 'region' && !known.forecasts.some(k => canonicalLevel(k.level) === 'region' && k.territory === f.territory))
            result.errors.push({ line, message: 'Aucun référentiel régional n’est intégré pour ce territoire.' });
    }
    const keys = new Set(known.forecasts.map(forecastKey));
    const collisions = result.preview.filter(f => keys.has(forecastKey(f)));
    if (collisions.length)
        result.errors.push({ line: 0, message: `${collisions.length} résultat(s) existent déjà avec ces identifiants/version. Importez une nouvelle version.` });
    result.duplicates += collisions.length;
    if (existing)
        return json({ ...result, warnings: [...new Set(warnings)], alreadyImported: true, imported: 0, hash });
    if (!b.confirm)
        return json({ ...result, warnings: [...new Set(warnings)], hash });
    if (result.errors.length)
        throw new HttpError(400, 'Import refusé : corrigez toutes les lignes signalées avant confirmation.');
    const imports = await Promise.all(result.preview.map(async (f) => ({ ...f, id: 'import-' + await digest(s.coopId + '|' + forecastKey(f)) })));
    const importId = crypto.randomUUID(), now = new Date().toISOString();
    const statements = [db.prepare('INSERT INTO scientific_imports (id,coop_id,owner_id,hash,data,created_at) VALUES (?,?,?,?,?,?)').bind(importId, s.coopId, s.userId, hash, JSON.stringify(imports), now), db.prepare("INSERT INTO scientific_forecasts (id,coop_id,import_id,data,created_at) SELECT json_extract(value,'$.id'),?,?,value,? FROM json_each(?)").bind(s.coopId,importId,now,JSON.stringify(imports))];
    try {
        await db.batch(statements);
    }
    catch (error) {
        if (error instanceof Error && /UNIQUE|constraint/i.test(error.message))
            throw new HttpError(409, 'Ces résultats viennent d’être importés. Actualisez l’aperçu; aucune ligne n’a été ajoutée deux fois.');
        throw error;
    }
    return json({ ...result, warnings: [...new Set(warnings)], imported: imports.length, hash });
}
catch (e) {
    return failure(e);
} }
