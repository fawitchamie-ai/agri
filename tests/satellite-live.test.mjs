import test from 'node:test';import assert from 'node:assert/strict';
import {satelliteDates,satelliteMapUrl} from '../lib/seasonal/satellite.ts';
test('live public satellite service: catalogue and PNG for a fixed public Togo sample', {skip:!process.env.CI,timeout:65000},async t=>{
 let xml;
 try{const r=await fetch('https://ows.digitalearth.africa/wms?service=WMS&version=1.3.0&request=GetCapabilities',{signal:AbortSignal.timeout(20000)});if(!r.ok){t.skip('Public catalogue HTTP '+r.status);return;}xml=await r.text();}catch(e){t.skip('Provider unavailable: '+e.message);return;}
 const catalog=satelliteDates(xml,new Date().toISOString().slice(0,10));
 t.diagnostic(JSON.stringify(Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,{dates:v.dates.length,latest:v.dates[0]}]))));
 assert.ok(catalog.rgb.dates.length,'Published RGB time/style was not decoded');assert.ok(catalog.ndvi.dates.length,'Published NDVI time/style was not decoded');assert.ok(catalog.anomaly.dates.length,'Monthly time/style was not decoded');
 const url=satelliteMapUrl('rgb',catalog.rgb.dates[0],[1,8,1.01,8.01]);let r;
 try{r=await fetch(url,{signal:AbortSignal.timeout(20000)});}catch(e){t.skip('Image provider unavailable: '+e.message);return;}
 if(!r.ok){t.skip('Image HTTP '+r.status);return;}
 const data=new Uint8Array(await r.arrayBuffer());assert.deepEqual([...data.slice(0,8)],[137,80,78,71,13,10,26,10]);t.diagnostic('Public PNG received, '+data.length+' bytes. Coverage/cloudiness still require parcel inspection.');
});
