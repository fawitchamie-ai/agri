/** JSON stdin -> JSON stdout; same pure engine as UI and Workers API. Node >=24. */
import { readFileSync } from 'node:fs';
import { planWater } from '../lib/seasonal/engine.ts';
import { CROPS, applyCropProfile } from '../lib/seasonal/catalog.ts';
import { referenceQuantities } from '../lib/seasonal/nutrition.ts';
import { seasonalCapabilities } from '../lib/seasonal/capabilities.ts';
const payload = JSON.parse(readFileSync(0,'utf8'));
const action=payload.action??'water';
let result;
if(action==='catalog')result=CROPS;
else if(action==='capabilities')result=seasonalCapabilities(payload.country,payload.cropId);
else if(action==='crop')result=applyCropProfile(payload.config,payload.cropId,payload.days);
else if(action==='nutrition')result=referenceQuantities(payload.referenceId,payload.config,payload.contextNote,payload.alreadyKgHa??[]);
else if(action==='water')result=planWater(payload.config,payload.events??[]);
else throw new Error('Action scientifique inconnue.');
process.stdout.write(JSON.stringify(result)+'\n');
