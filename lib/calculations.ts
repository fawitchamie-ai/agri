/** Pure, unit-explicit application arithmetic. Never trains or updates a model. */
export function finiteNonnegative(value: unknown, label = 'Valeur'): number { if ((typeof value !== 'number' && typeof value !== 'string') || value === null || value === undefined || String(value).trim() === '')
    throw new Error(`${label} est obligatoire.`); const n = Number(value); if (!Number.isFinite(n) || n < 0)
    throw new Error(`${label} doit être un nombre positif ou nul.`); return n; }
function checked(n: number) { if (!Number.isFinite(n))
    throw new Error('Le calcul dépasse les limites numériques.'); return n; }
export function tonnes(quantity: number, unit: string, bagWeight = 50): number { const q = finiteNonnegative(quantity, 'Quantité'); if (unit === 't')
    return q; if (unit === 'kg')
    return q / 1000; if (unit === 'sac') {
    if (!Number.isFinite(bagWeight) || bagWeight <= 0)
        throw new Error('Le poids du sac doit être strictement positif.');
    return checked(q * bagWeight / 1000);
} throw new Error('Unité non reconnue : t, kg ou sac.'); }
export function production(yieldT: number, area: number): number { return checked(finiteNonnegative(yieldT, 'Rendement') * finiteNonnegative(area, 'Superficie')); }
export function observedYield(quantityT: number, area: number): number { if (!Number.isFinite(area) || area <= 0)
    throw new Error('La superficie récoltée doit être strictement positive.'); return checked(finiteNonnegative(quantityT, 'Production') / area); }
export function weightedYield(rows: {
    productionT: number;
    area: number;
}[]): number | null { const area = rows.reduce((s, r) => s + finiteNonnegative(r.area), 0); if(!Number.isFinite(area))throw new Error('Les superficies dépassent les limites numériques.');return area > 0 ? checked(rows.reduce((s, r) => s + finiteNonnegative(r.productionT), 0) / area) : null; }
export function pairedMetrics(pairs: {
    prediction: number;
    observation: number;
}[]) { const clean = pairs.filter(p => Number.isFinite(p.prediction) && Number.isFinite(p.observation)); if (!clean.length)
    return { n: 0, mae: null, rmse: null, bias: null, mape: null, relativeN: 0 }; const e = clean.map(p => p.prediction - p.observation), relative = clean.filter(p => p.observation !== 0); return { n: e.length, mae: e.reduce((a, b) => a + Math.abs(b), 0) / e.length, rmse: Math.sqrt(e.reduce((a, b) => a + b * b, 0) / e.length), bias: e.reduce((a, b) => a + b, 0) / e.length, mape: relative.length ? relative.reduce((a, p) => a + Math.abs((p.prediction - p.observation) / p.observation), 0) / relative.length * 100 : null, relativeN: relative.length }; }
/** Lifecycle columns are alternatives, never summed into a total harvest. */
export function collectionTotals(rows: Record<string, unknown>[]) { return Object.fromEntries(['estimated', 'declared', 'committed', 'collected'].map(k => [k, rows.reduce((s, r) => s + finiteNonnegative(r[k] ?? 0), 0)])); }
export function csvCell(value: unknown): string { let s = value === null || value === undefined ? '' : String(value); if (/^[\s]*[=+\-@]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }
export function csvText(rows: Record<string, unknown>[], columns: string[]): string { return '\uFEFF' + [columns.map(csvCell).join(','), ...rows.map(r => columns.map(k => csvCell(r[k])).join(','))].join('\r\n'); }
