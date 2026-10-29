/** Arithmetic after a locally justified nutrient requirement is supplied.
 * Soil total N/pH alone cannot establish this requirement. All values N-P2O5-K2O. */
import { InputError } from './validation.ts';
export function nutrientBalance(areaM2: number, target: number[], products: { name: string; kgHa: number; compositionPercent: number[]; pricePerKg: number | null }[], alreadyApplied: number[] = [0,0,0]) {
  const valid = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (!valid(areaM2) || areaM2 <= 0 || target.length !== 3 || alreadyApplied.length !== 3 || !target.every(valid) || !alreadyApplied.every(valid) || products.length > 20) throw new InputError('Surface et besoins N–P₂O₅–K₂O non négatifs attendus.');
  const supplied = [...alreadyApplied];
  const quantities = products.map(p => {
    if (!p.name.trim() || !valid(p.kgHa) || p.compositionPercent.length !== 3 || !p.compositionPercent.every(x => valid(x) && x <= 100) || p.compositionPercent.reduce((s,x)=>s+x,0) > 100 || p.pricePerKg !== null && !valid(p.pricePerKg)) throw new InputError('Dose, teneurs ou prix du produit invalides.');
    p.compositionPercent.forEach((x, i) => supplied[i] += p.kgHa * x / 100);
    const kg = p.kgHa * areaM2 / 10000;
    return { name: p.name, kg, cost: p.pricePerKg === null ? null : kg * p.pricePerKg };
  });
  return { targetKgHa: target, suppliedKgHa: supplied, remainingKgHa: target.map((x,i)=>Math.max(0,x-supplied[i])), excessKgHa: target.map((x,i)=>Math.max(0,supplied[i]-x)), quantities, caveat: 'Bilan de quantités, sans dose recommandée automatiquement. Le besoin cible doit provenir d’une méthode locale validée ; N, P₂O₅ et K₂O ne sont pas des éléments interchangeables.' };
}
