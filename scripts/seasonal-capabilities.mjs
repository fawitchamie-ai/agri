/** Rebuild the capability matrix from the same functions as API/UI/notebook. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { COUNTRIES } from '../lib/seasonal/types.ts';
import { CROPS } from '../lib/seasonal/catalog.ts';
import { seasonalCapabilities } from '../lib/seasonal/capabilities.ts';
const out = resolve(process.argv[2] ?? 'docs/refonte');
mkdirSync(out, { recursive: true });
const fields = ['country','crop','capability','status','reason'];
const lines = [fields];
for (const country of Object.keys(COUNTRIES)) for (const crop of CROPS) {
  const c = seasonalCapabilities(country, crop.id);
  for (const key of ['waterSimulation','nutritionReferences','personalizedFertilization','seasonalYieldForecast','chemicalCropProtection','prospectiveValidation']) {
    lines.push([country, crop.id, key, c[key].status, c[key].reason]);
  }
}
const quote = v => '"' + String(v).replaceAll('"','""') + '"';
writeFileSync(resolve(out, 'MATRICE_CAPACITES.csv'), lines.map(row => row.map(quote).join(',')).join('\n') + '\n');
console.log(`${lines.length - 1} états de capacité écrits pour six pays et ${CROPS.length} cultures.`);
