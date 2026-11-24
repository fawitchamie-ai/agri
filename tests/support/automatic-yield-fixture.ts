import {exampleCampaign} from '../../lib/seasonal/example.ts';
import {applyCropProfile} from '../../lib/seasonal/catalog.ts';
import {addDays} from '../../lib/seasonal/validation.ts';
import {testParcel,landFixture} from './land-fixtures.mjs';
import {parcelMetrics} from '../../lib/seasonal/parcel.ts';
export function automaticYieldFixture(){
 const today=new Date().toISOString().slice(0,10),c=applyCropProfile(exampleCampaign(today),'maize');
 c.parcelGeometry=testParcel;c.areaM2=parcelMetrics(testParcel).areaM2;c.landAssessment=landFixture(testParcel);c.landSelection='potentialLand';c.waterCondition='drained';
 c.automaticYield={version:'automatic-yield-input-1',enabled:true};c.fallback=null;
 c.weather=Array.from({length:c.stages.reduce((n,s)=>n+s.days,0)},(_,i)=>({date:addDays(today,i),rainMm:4,et0Mm:4,temperatureMeanC:28,radiationMj:18,status:'scenario' as const,source:'SYNTHETIC SOFTWARE TEST ONLY',availableAt:today+'T00:00:00Z'}));
 return c;
}
