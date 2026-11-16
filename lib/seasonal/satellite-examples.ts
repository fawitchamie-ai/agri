import {emptyCampaign} from './example.ts';
import {parcelMetrics,type ParcelPolygon} from './parcel.ts';
import {FIELD_ZONES_VERSION,fieldMonitoringScope,type ZoneSeasonRead} from './field-zones.ts';
import {fieldImageSummary} from './field-analysis.ts';
import {zoneGrid} from './field-zones.ts';
import type {Country} from './types.ts';

export const SATELLITE_EXAMPLES=[{id:'togo-2024',name:'Togo 2024'},{id:'togo-2025',name:'Togo 2025'},{id:'benin-2024',name:'Bénin 2024'}];
export type SatelliteExample={id:string;name:string;country:Country;geometry:ParcelPolygon;dates:string[];observations:ZoneSeasonRead[]};
export function satelliteExampleCampaign(e:SatelliteExample,today=new Date().toISOString().slice(0,10)){
 const c=emptyCampaign(today),metrics=parcelMetrics(e.geometry),grid=zoneGrid(e.geometry);
 c.country=e.country;c.name=e.name+' · exemple satellite';c.territory='Contour technique public';c.parcelGeometry=e.geometry;c.areaM2=metrics.areaM2;c.latitude=metrics.point[1];c.longitude=metrics.point[0];
 c.crop='Culture non confirmée';c.variety='Non confirmée';c.sowingDate=e.dates[0].slice(0,4)+'-10-01';c.stages=[];c.weather=[];c.fallback=null;
 c.parameterSource='Exemple de lecture satellite. Aucune culture, date de semis, conduite ou récolte confirmée. Le 1er octobre repère la période de consultation.';
 c.fieldMonitoring={version:FIELD_ZONES_VERSION,scope:fieldMonitoringScope(c),cultivatedContour:false,comparableManagement:false,seasons:[],datedObservations:e.observations,currentObservation:e.observations.filter(r=>{const s=fieldImageSummary(grid,r);return s.cells>=12&&s.coverage>=.6;}).at(-1)};
 return c;
}
