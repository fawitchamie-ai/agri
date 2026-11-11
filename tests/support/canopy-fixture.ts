import {exampleCampaign} from '../../lib/seasonal/example.ts';
import {applyCropProfile} from '../../lib/seasonal/catalog.ts';
import {canopyNowcastScope} from '../../lib/seasonal/canopy-nowcast.ts';
import {geometryIdentity} from '../../lib/seasonal/provenance.ts';
import {parcelMetrics} from '../../lib/seasonal/parcel.ts';
import {landFixture} from './land-fixtures.mjs';
export function canopyFixture(){
 const c=applyCropProfile(exampleCampaign('2026-09-01'),'maize');c.asOfDate='2026-11-11';c.country='GHA';c.waterCondition='drained';
 c.parcelGeometry={type:'Polygon',coordinates:[[[-.5,9.5],[-.499,9.5],[-.499,9.501],[-.5,9.501],[-.5,9.5]]]};
 const m=parcelMetrics(c.parcelGeometry);c.areaM2=m.areaM2;c.latitude=m.point[1];c.longitude=m.point[0];c.landAssessment=landFixture(c.parcelGeometry);c.landSelection='potentialLand';
 c.sowingPlan={version:'sowing-input-1',geometryId:geometryIdentity(c.parcelGeometry),cropId:'maize',areaM2:1000,seedRateKgHa:null,source:'Synthetic area, not observed crop'};
 c.canopyNowcast={version:'canopy-nowcast-1',acceptedHypothesis:true,scope:canopyNowcastScope(c),monitoringStart:'2026-10-28',initialStage:'vegetative',observations:[
  {date:'2026-10-28',availableOn:'2026-10-28',laiSamples:[.8,.9,1,1.1],source:'Synthetic instrument measurements',method:'field-green-lai'},
  {date:'2026-11-04',availableOn:'2026-11-04',laiSamples:[1.3,1.4,1.6,1.7],source:'Synthetic instrument measurements',method:'field-green-lai'}]};
 return c;
}
