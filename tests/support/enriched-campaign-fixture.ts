import {fieldObservationFixture} from './field-zones-fixture.ts';
import {landFixture} from './land-fixtures.mjs';
import {growthTemplate} from '../../lib/seasonal/growth.ts';
import {emptyManagement} from '../../lib/seasonal/management.ts';
import {addDays} from '../../lib/seasonal/validation.ts';
import {geometryIdentity,migrateInputs} from '../../lib/seasonal/provenance.ts';
import {fieldMonitoringScope} from '../../lib/seasonal/field-zones.ts';

/** Deliberately rich software fixture, without a real farm or harvest claim. */
export function enrichedCampaignFixture(){
 const c=fieldObservationFixture();c.waterCondition='drained';c.landSelection='potentialLand';c.landAssessment=landFixture(c.parcelGeometry!);
 c.sowingDate=addDays(c.asOfDate,10);c.fallback=null;
 c.weather=Array.from({length:125},(_,i)=>({date:addDays(c.sowingDate,i),rainMm:i%6===0?10:0,et0Mm:4,temperatureMeanC:28,temperatureMinC:22,temperatureMaxC:34,humidityPercent:60,wind2mMs:2,radiationMj:18,status:'scenario' as const,source:'Explicit synthetic climate; not a forecast',availableAt:c.asOfDate+'T00:00:00Z'}));
 c.sowingPlan={version:'sowing-input-1',geometryId:geometryIdentity(c.parcelGeometry),cropId:'maize',areaM2:c.areaM2!,seedRateKgHa:null,source:'Synthetic whole-field area for software test'};
 c.managementPlan=emptyManagement(c);c.managementPlan.irrigation={mode:'manual',applications:[20,45,65,85,105].map(i=>({date:addDays(c.sowingDate,i),fieldM3Ha:200}))};
 c.managementPlan.products=[{id:'test-npk',date:addDays(c.sowingDate,20),kind:'fertilizer',product:'Synthetic NPK',dose:100,unit:'kg/ha',status:'planned',source:'Software hypothesis, not an agronomic prescription',npkPercent:[15,15,15]}];
 c.growth=growthTemplate(c);
 const observation=c.fieldMonitoring!.currentObservation!;
 c.fieldMonitoring!.scope=fieldMonitoringScope(c);
 c.fieldMonitoring!.datedObservations=[20,10,0].map(n=>{const r=structuredClone(observation),date=addDays(c.asOfDate,-n);r.season={...r.season,id:'software-'+date,startDate:date,endDate:date};r.scenes[0].date=date;return r;});
 const result=migrateInputs(c);
 for(const [path,v] of Object.entries(result.inputs!.values))if(path.startsWith('weather.')){
  v.origin='manual';v.status='scenario';v.acquiredAt=c.asOfDate+'T00:00:00Z';v.referencePeriod={from:'2021-01-01',to:'2021-12-31'};
  v.method='Synthetic complete daily evidence for a climate scenario; '.repeat(12);
  v.replacementReason='An explicit software scenario, never a measured field condition; '.repeat(12);
 }
 return result;
}
