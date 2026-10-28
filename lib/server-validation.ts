import type { RecordKind } from './contracts';
import { finiteNonnegative, observedYield, production, tonnes } from './calculations';
const kinds = ['member', 'simulation', 'collection', 'harvest', 'capacity'];
function text(d: Record<string, any>, key: string, required = true, max = 300) { const v = d[key]; if (required && (typeof v !== 'string' || !v.trim()))
    throw new Error(`Le champ ${key} est obligatoire.`); if (v !== undefined && v !== null && (typeof v !== 'string' || v.length > max))
    throw new Error(`Le champ ${key} est invalide ou trop long.`); return typeof v === 'string' ? v.trim() : ''; }
function n(d: Record<string, any>, key: string, positive = false, optional = false) { const value = finiteNonnegative(optional ? (d[key] ?? 0) : d[key], key); if (value > 1e9 || (positive && value <= 0))
    throw new Error(`${key} est hors des limites autorisées.`); return value; }
function date(value: unknown, label: string) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)
    throw new Error(`${label} doit être une date valide.`); return value; }
export function validateRecord(kind: RecordKind, input: unknown) {
    if (!kinds.includes(kind))
        throw new Error('Type d’enregistrement inconnu.');
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw new Error('Données attendues.');
    const d = input as Record<string, any>, data: Record<string, any> = {}, warnings: string[] = [];
    if (kind === 'member') {
        data.name = text(d, 'name', true, 120);
        data.locality = text(d, 'locality', true, 160);
        return { data, warnings };
    }
    if (kind === 'capacity') {
        data.storage = n(d, 'storage', false, true);
        data.transport = n(d, 'transport', false, true);
        data.point = text(d, 'point', false, 160);
        return { data, warnings };
    }
    data.crop = text(d, 'crop', true, 100);
    data.territory = text(d, 'territory', true, 160);
    data.year = n(d, 'year', true);
    if (!Number.isInteger(data.year) || data.year < 1900 || data.year > 2100)
        throw new Error('Campagne invalide.');
    if (kind === 'simulation') {
        data.name = text(d, 'name', false, 120);
        data.areaType = d.areaType || 'recoltee';
        if (!['recoltee', 'semee', 'prevue'].includes(data.areaType))
            throw new Error('Type de superficie invalide.');
        data.source = text(d, 'source', false, 300);
        data.area = n(d, 'area', true);
        data.yield = n(d, 'yield');
        data.bagWeight = d.bagWeight === undefined ? 50 : n(d, 'bagWeight', true);
        data.forecastId = text(d, 'forecastId', false, 180);
        data.scenarioLow = d.scenarioLow === undefined ? data.yield : n(d, 'scenarioLow');
        data.scenarioHigh = d.scenarioHigh === undefined ? data.yield : n(d, 'scenarioHigh');
        if (data.scenarioLow > data.yield || data.scenarioHigh < data.yield)
            throw new Error('Le scénario bas doit être inférieur au central et le haut supérieur au central.');
        data.productionT = production(data.yield, data.area);
        data.productionLowT = production(data.scenarioLow, data.area);
        data.productionHighT = production(data.scenarioHigh, data.area);
        data.hypothesis = 'Le rendement territorial est appliqué à une superficie supposée compatible. Aucune validation parcellaire.';
        data.comment = text(d, 'comment', false, 2000);
    }
    if (kind === 'harvest') {
        data.memberId = text(d, 'memberId', true, 180);
        data.producer = text(d, 'producer', true, 120);
        data.area = n(d, 'area', true);
        data.quantity = n(d, 'quantity');
        data.unit = text(d, 'unit');
        data.bagWeight = d.unit === 'sac' ? n(d, 'bagWeight', true) : 50;
        data.productionT = tonnes(data.quantity, data.unit, data.bagWeight);
        data.yieldObserved = observedYield(data.productionT, data.area);
        data.date = date(d.date, 'Date de récolte');
        if (data.date > new Date().toISOString().slice(0, 10))
            throw new Error('La date de récolte ne peut pas être future.');
        data.method = text(d, 'method');
        if (!['declaration', 'measure'].includes(data.method))
            throw new Error('Mode d’obtention invalide.');
        data.status = text(d, 'status');
        if (!['brouillon', 'soumis', 'valide'].includes(data.status))
            throw new Error('État de récolte invalide.');
        data.comment = text(d, 'comment', false, 2000);
        data.evidence = text(d, 'evidence', false, 500);
        data.provenance = 'Observation communautaire, distincte des statistiques officielles et des données d’entraînement.';
        if (data.yieldObserved > 20)
            warnings.push('Rendement supérieur à 20 t/ha : vérifiez les unités et la superficie. La donnée est conservée.');
    }
    if (kind === 'collection') {
        data.memberId = text(d, 'memberId', true, 180);
        data.harvestId = text(d, 'harvestId', false, 180);
        for (const key of ['estimated', 'declared', 'committed', 'collected'])
            data[key] = n(d, key, false, true);
        data.point = text(d, 'point', true, 160);
        data.date = date(d.date, 'Date de collecte');
        data.slotHHmm = text(d, 'slotHHmm', false, 5);
        if (data.slotHHmm && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.slotHHmm))
            throw new Error('Créneau invalide (HH:mm attendu).');
        data.status = text(d, 'status');
        if (!['prevu', 'confirme', 'partiel', 'termine', 'annule'].includes(data.status))
            throw new Error('Statut de collecte invalide.');
        data.comment = text(d, 'comment', false, 2000);
    }
    return { data, warnings };
}
