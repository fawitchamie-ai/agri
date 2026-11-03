import test from 'node:test';
import assert from 'node:assert/strict';
import {satelliteDates,satelliteBounds,satelliteMapUrl,satelliteImage,satelliteBasemapUrl,satelliteTilePlan,SATELLITE_WMS} from '../lib/seasonal/satellite.ts';
const caps='<WMS_Capabilities><Capability><Layer><Title>Test only</Title><Layer><Name>s2_l2a</Name><Dimension name="time">2026-11-03,2026-10-13,2026-10-12</Dimension><Style><Name>simple_rgb</Name></Style><Style><Name>ndvi</Name></Style><Style><Name>scl</Name></Style></Layer><Layer><Name>ndvi_anomaly</Name><Dimension name="time">2026-09-01,2026-08-01</Dimension><Style><Name>style_ndvi_anomaly</Name></Style><Style><Name>style_count</Name></Style></Layer></Layer></Capability></WMS_Capabilities>';
const shape={type:'Polygon' as const,coordinates:[[[1,8],[1.001,8],[1.001,8.001],[1,8.001],[1,8]]] as [number,number][][]};
test('satellite dates come from published capabilities, exclude future dates, retain native resolution',()=>{
 const d=satelliteDates(caps,'2026-11-02');assert.deepEqual(d.rgb.dates,['2026-10-13','2026-10-12']);assert.equal(d.ndvi.resolutionM,10);assert.equal(d.anomaly.resolutionM,30);assert.equal(d.anomaly.period,'month');assert.equal(d.clear.style,'style_count');assert.throws(()=>satelliteDates(caps,'not a date'));
});
test('WMS bounds preserve the field and native context; upstream URL is fixed and rejects forged inputs',()=>{
 const b=satelliteBounds(shape);assert.ok(b[0]<1&&b[1]<8&&b[2]>1.001&&b[3]>8.001);const u=new URL(satelliteMapUrl('ndvi','2026-10-13',b));assert.equal(u.origin,'https://ows.digitalearth.africa');assert.equal(u.searchParams.get('crs'),'EPSG:4326');assert.equal(u.searchParams.get('styles'),'ndvi');assert.equal(u.searchParams.get('width'),'512');assert.equal(u.searchParams.get('height'),'320');assert.equal(u.searchParams.get('version'),'1.3.0');assert.equal(u.searchParams.get('bbox'),[b[1],b[0],b[3],b[2]].join(','));assert.throws(()=>satelliteMapUrl('remote-url' as any,'2026-10-13',b));assert.throws(()=>satelliteMapUrl('rgb','2026-02-30',b));assert.throws(()=>satelliteMapUrl('rgb','2026-10-13',[0,0,180,80]));
});
test('satellite image verifies the PNG payload and never relabels provider errors as imagery',async()=>{
 const calls:string[]=[];const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
 const fetcher=(async(input:RequestInfo|URL)=>{const u=String(input);calls.push(u);return u.includes('GetCapabilities')?new Response(caps):new Response(png,{headers:{'Content-Type':'image/png'}});}) as typeof fetch;
 const image=await satelliteImage('rgb','2026-10-13',satelliteBounds(shape),fetcher);assert.equal(image.headers.get('Content-Type'),'image/png');assert.equal(image.headers.get('X-Satellite-Date'),'2026-10-13');assert.ok(calls.every(u=>u.startsWith(SATELLITE_WMS)));
 const broken=(async(input:RequestInfo|URL)=>String(input).includes('GetCapabilities')?new Response(caps):new Response('<ServiceException>missing</ServiceException>')) as typeof fetch;
 await assert.rejects(satelliteImage('rgb','2026-10-13',satelliteBounds(shape),broken),/PNG/);await assert.rejects(satelliteImage('rgb','2026-09-30',satelliteBounds(shape),fetcher),/pas publiée/);
});

test('field acquisition dates are bounded and scene cloudiness never becomes parcel cloudiness',async()=>{
 const {satelliteScenes}=await import('../lib/seasonal/satellite.ts');let requested='';
 const fetcher=(async(u:RequestInfo|URL)=>{requested=String(u);return Response.json({features:[{properties:{datetime:'2026-10-12T10:00:00Z','eo:cloud_cover':12}},{properties:{datetime:'2026-10-12T10:01:00Z','eo:cloud_cover':30}},{properties:{datetime:'2026-11-03T10:00:00Z','eo:cloud_cover':0}}]});}) as typeof fetch;
 const r=await satelliteScenes(shape,'2026-11-02',fetcher);assert.deepEqual(r.dates,[{date:'2026-10-12',sceneCloudMin:12,sceneCloudMax:30}]);assert.match(r.scope,/scène entière/);assert.equal(new URL(requested).origin,'https://explorer.digitalearth.africa');assert.equal(new URL(requested).searchParams.get('sortby'),'-datetime');assert.equal(new URL(requested).searchParams.get('limit'),'60');
});

test('real-world WMS timestamps, namespace and interval dimensions do not become an empty catalogue',()=>{
 const stamp=caps.replace('2026-11-03,2026-10-13,2026-10-12','2026-10-12T00:00:00.000Z/2026-11-03T00:00:00.000Z/P1D').replace('2026-09-01,2026-08-01','2026-08-01T00:00:00Z,2026-09-01T00:00:00Z');
 const d=satelliteDates(stamp,'2026-11-02');assert.equal(d.rgb.dates[0],'2026-11-02');assert.equal(d.rgb.dates.at(-1),'2026-10-12');assert.deepEqual(d.anomaly.dates,['2026-09-01','2026-08-01']);
 const older=stamp.replaceAll('Dimension','Extent');assert.deepEqual(satelliteDates(older,'2026-11-02').rgb.dates,d.rgb.dates);
});


test('high resolution preview uses four seam-free requests within the WMS cap, preserving geographic alignment',()=>{
 const bounds=satelliteBounds(shape,1000),tiles=satelliteTilePlan('ndvi','2026-10-13',bounds);
 assert.equal(tiles.length,4);
 const [nw,ne,sw,se]=tiles.map(t=>t.bounds);
 assert.equal(nw[0],bounds[0]);assert.equal(nw[3],bounds[3]);
 assert.equal(se[2],bounds[2]);assert.equal(se[1],bounds[1]);
 assert.equal(nw[2],ne[0]);assert.equal(nw[1],sw[3]);assert.equal(sw[2],se[0]);assert.equal(ne[1],se[3]);
 for(const tile of tiles){
  const direct=new URL(tile.direct),proxy=new URL(tile.src,'https://agri.test');
  assert.equal(direct.origin,'https://ows.digitalearth.africa');
  assert.equal(direct.searchParams.get('width'),'512');assert.equal(direct.searchParams.get('height'),'320');
  assert.equal(proxy.searchParams.get('bbox'),tile.bounds.join(','));
  assert.equal(direct.searchParams.get('bbox'),[tile.bounds[1],tile.bounds[0],tile.bounds[3],tile.bounds[2]].join(','));
  assert.equal(direct.searchParams.get('time'),'2026-10-13');
 }
 const narrow=satelliteBounds(shape);assert.ok(bounds[3]-bounds[1]>(narrow[3]-narrow[1])*3);
 assert.throws(()=>satelliteBounds(shape,1));assert.throws(()=>satelliteBounds(shape,Infinity));
 const hd=new URL(satelliteBasemapUrl(narrow));assert.equal(hd.searchParams.get('size'),'1600,1000');
 assert.equal(hd.searchParams.get('bbox'),narrow.join(','));assert.equal(hd.searchParams.get('imageSR'),'4326');
 assert.throws(()=>satelliteTilePlan('ndvi','2026-10-13',[0,0,360,80]));
});
