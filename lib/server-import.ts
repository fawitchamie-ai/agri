import type { Forecast } from './contracts';
export const IMPORT_COLUMNS = ['crop', 'year', 'territory', 'level', 'yield', 'model', 'version', 'issuedAt', 'status', 'source', 'areaDefinition'];
export function parseCSV(csv: string): string[][] { const rows: string[][] = []; let row: string[] = [], value = '', quoted = false; for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
        if (quoted && csv[i + 1] === '"') {
            value += '"';
            i++;
        }
        else if (!quoted && value !== '')
            throw new Error('Guillemet inattendu.');
        else
            quoted = !quoted;
    }
    else if (c === ',' && !quoted) {
        row.push(value);
        value = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && csv[i + 1] === '\n')
            i++;
        row.push(value);
        if (row.some(v => v.trim() !== ''))
            rows.push(row);
        row = [];
        value = '';
    }
    else
        value += c;
} if (quoted)
    throw new Error('Guillemets non fermés.'); row.push(value); if (row.some(v => v.trim() !== ''))
    rows.push(row); return rows; }
export function validateImport(csv: string) { const rows = parseCSV(csv.replace(/^\uFEFF/, '')); if (!rows.length)
    throw new Error('Le fichier est vide.'); const header = rows.shift()!.map(s => s.trim());
    if(!rows.length)throw new Error('Le fichier ne contient aucune ligne de résultat.'); if (new Set(header).size !== header.length || IMPORT_COLUMNS.some(c => !header.includes(c)) || header.some(c => !IMPORT_COLUMNS.includes(c) && c !== 'id'))
    throw new Error('Colonnes attendues : ' + IMPORT_COLUMNS.join(',')); if (rows.length > 10000)
    throw new Error('Maximum 10 000 lignes par import.'); const errors: {
    line: number;
    message: string;
}[] = [], valid: Omit<Forecast, 'id'>[] = [], lineNumbers: number[] = [], seen = new Set<string>(); let duplicates = 0; rows.forEach((cells, i) => { try {
    if (cells.length !== header.length)
        throw new Error('Nombre de colonnes incorrect.');
    const r = Object.fromEntries(header.map((h, k) => [h, cells[k].trim()]));
    const aliases: Record<string, string> = { 'Préfecture historique': 'prefecture_historique', 'Région': 'region', 'National': 'national' };
    r.level = aliases[r.level] || r.level;
    for (const c of IMPORT_COLUMNS.filter(c => c !== 'issuedAt'))
        if (!r[c] || r[c].length > 500)
            throw new Error(`Champ ${c} vide ou trop long.`);
    const year = Number(r.year), yieldValue = Number(r.yield);
    if (!Number.isInteger(year) || year < 1900 || year > 2100)
        throw new Error('Année invalide.');
    if (!Number.isFinite(yieldValue) || yieldValue < 0 || yieldValue > 1e6)
        throw new Error('Rendement invalide (t/ha attendu).');
    if (!['prefecture_historique', 'region', 'national'].includes(r.level))
        throw new Error('Niveau attendu : prefecture_historique, region ou national.');
    if (!['exploratoire', 'evalue_retrosp'].includes(r.status))
        throw new Error('Statut attendu : exploratoire ou evalue_retrosp.');
    if (r.issuedAt && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(r.issuedAt) || !Number.isFinite(Date.parse(r.issuedAt)) || new Date(r.issuedAt.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) !== r.issuedAt.slice(0, 10)))
        throw new Error('Date d’émission invalide : date et heure ISO avec fuseau attendues.');
    const key = [r.crop, year, r.territory, r.level, r.model, r.version].join('|');
    if (seen.has(key)) {
        duplicates++;
        throw new Error('Doublon de culture/année/territoire/niveau/modèle/version dans ce fichier.');
    }
    seen.add(key);
    lineNumbers.push(i + 2);
    valid.push({ crop: r.crop, year, territory: r.territory, level: r.level, yield: yieldValue, model: r.model, version: r.version, issuedAt: r.issuedAt || null, status: r.status, source: r.source, areaDefinition: r.areaDefinition });
}
catch (e) {
    errors.push({ line: i + 2, message: e instanceof Error ? e.message : 'Ligne invalide.' });
} }); return { rows: rows.length, preview: valid, lineNumbers, errors, duplicates }; }
export function canonicalLevel(level: string) { const levels: Record<string, string> = { 'Préfecture historique': 'prefecture_historique', 'Région': 'region', 'National': 'national' }; return levels[level] || level; }
export function forecastKey(f: {
    crop: string;
    year: number;
    territory: string;
    level: string;
    model: string;
    version: string;
}) { return [f.crop, f.year, f.territory, canonicalLevel(f.level), f.model, f.version].join('|'); }
