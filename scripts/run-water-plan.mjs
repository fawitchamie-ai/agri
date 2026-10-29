/** JSON stdin -> JSON stdout; same pure engine as UI and Workers API. Node >=24. */
import { readFileSync } from 'node:fs';
import { planWater } from '../lib/seasonal/engine.ts';
const payload = JSON.parse(readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(planWater(payload.config,payload.events??[]))+'\n');
