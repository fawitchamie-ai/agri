import test from 'node:test';import assert from 'node:assert/strict';
import {satelliteDates,satelliteMapUrl} from '../lib/seasonal/satellite.ts';
test('live public satellite service: catalogue and PNG for a fixed public Togo sample', {skip:!process.env.CI,timeout:150000},async t=>{
 let xml;
 try{const r=await fetch('https://ows.digitalearth.africa/wms?service=WMS&version=1.3.0&request=GetCapabilities',{signal:AbortSignal.timeout(20000)});if(!r.ok){t.skip('Public catalogue HTTP '+r.status);return;}xml=await r.text();}catch(e){t.skip('Provider unavailable: '+e.message);return;}
 const sceneUrl='https://explorer.digitalearth.africa/stac/search?collections=s2_l2a&bbox=1,8,1.01,8.01&datetime=2026-07-01T00:00:00Z/2026-11-03T23:59:59Z&sortby=-datetime&limit=3';let localDate;try{const sr=await fetch(sceneUrl,{signal:AbortSignal.timeout(20000)});const st=await sr.text();t.diagnostic('STAC '+sr.status+' '+st.slice(0,1000));if(sr.ok)localDate=JSON.parse(st).features?.[0]?.properties?.datetime?.slice(0,10);}catch(e){t.diagnostic('STAC '+e.message);}
 const catalog=satelliteDates(xml,new Date().toISOString().slice(0,10));
 t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,{dates:v.dates.length,latest:v.dates[0]}]))));
 assert.ok(catalog.rgb.dates.length,'Published RGB time/style was not decoded');assert.ok(catalog.ndvi.dates.length,'Published NDVI time/style was not decoded');assert.ok(catalog.anomaly.dates.length,'Monthly time/style was not decoded');
 for(const layer of ['rgb','ndvi','anomaly']){
  const url=satelliteMapUrl(layer,(layer==='anomaly'?catalog[layer].dates[0]:localDate??catalog[layer].dates[0]),[1,8,1.01,8.01]);let r;
  try{r=await fetch(url,{signal:AbortSignal.timeout(35000)});}catch(e){t.skip('Image provider unavailable: '+e.message);return;}
  if(r.status>=500){t.skip('Provider outage HTTP '+r.status);return;}
  assert.ok(r.ok,'Image '+layer+' HTTP '+r.status+' '+(r.ok?'':await r.text()).slice(0,1800));
  const data=new Uint8Array(await r.arrayBuffer());assert.deepEqual([...data.slice(0,8)],[137,80,78,71,13,10,26,10]);
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);assert.equal(view.getUint32(16),512);assert.equal(view.getUint32(20),320);
  t.diagnostic('Public PNG '+layer+' received, '+data.length+' bytes, 512x320. Parcel coverage/cloudiness remain to inspect.');
 }
});
