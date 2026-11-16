import {applyCropProfile} from '../../lib/seasonal/catalog.ts';
import {exampleCampaign} from '../../lib/seasonal/example.ts';
import {parcelMetrics} from '../../lib/seasonal/parcel.ts';
import {geometryIdentity} from '../../lib/seasonal/provenance.ts';
import {FIELD_ZONES_VERSION,fieldMonitoringScope,zoneGrid,type ZoneSeasonRead} from '../../lib/seasonal/field-zones.ts';
export function fieldZonesFixture(){
 const today=new Date().toISOString().slice(0,10),c=applyCropProfile(exampleCampaign(today),'maize');
 c.sowingDate=today;c.asOfDate=today;c.weather=[];
 c.parcelGeometry={type:'Polygon',coordinates:[[[1.2,9.4],[1.202,9.4],[1.202,9.402],[1.2,9.402],[1.2,9.4]]]};
 const metrics=parcelMetrics(c.parcelGeometry);c.areaM2=metrics.areaM2;c.latitude=metrics.point[1];c.longitude=metrics.point[0];
 const grid=zoneGrid(c.parcelGeometry),year=Number(today.slice(0,4));
 const seasons:ZoneSeasonRead[]=Array.from({length:4},(_,i)=>{const y=year-4+i;return {version:FIELD_ZONES_VERSION,geometryId:geometryIdentity(c.parcelGeometry),season:{id:'test-'+y,startDate:y+'-06-01',endDate:y+'-08-01',cropId:'maize',comparable:true},retrievedOn:today,source:'SYNTHETIC SOFTWARE TEST — NOT REAL SATELLITE DATA',gridM:grid.gridM,
  scenes:[{date:y+'-06-15',itemId:'synthetic-1',clearFraction:1},{date:y+'-07-15',itemId:'synthetic-2',clearFraction:1}],
  cells:grid.cells.map((cell,index)=>[cell.id,.2+.6*index/(grid.cells.length-1),2]),issues:[]};});
 c.fieldMonitoring={version:FIELD_ZONES_VERSION,scope:fieldMonitoringScope(c),cultivatedContour:true,comparableManagement:true,seasons};return c;
}
export function fieldObservationFixture(){
 const c=fieldZonesFixture(),record=structuredClone(c.fieldMonitoring!.seasons[0]),date=c.asOfDate;
 record.season={id:'observation-'+date,startDate:date,endDate:date,cropId:'unknown',comparable:false};record.scenes=[{date,itemId:'SYNTHETIC SOFTWARE TEST ACQUISITION',clearFraction:1}];record.cells=record.cells.map(([id,value])=>[id,value,1]);
 c.fieldMonitoring!.seasons=[];c.fieldMonitoring!.currentObservation=record;return c;
}
