import test from 'node:test';import assert from 'node:assert/strict';
import {intersection} from '../lib/seasonal/geometry-ops.ts';
import {sphericalRingAreaM2,AREA_METHOD} from '../lib/seasonal/spherical-area.ts';
import {assessLandGeometry,multiArea,type LandLayer} from '../lib/seasonal/land.ts';
import {partitionLandSafely} from '../lib/seasonal/land-provider.ts';
import {polygonFromPoints,parcelMetrics,type ParcelPolygon,type Position} from '../lib/seasonal/parcel.ts';
const rect=(x:number,y:number,w:number,h:number):ParcelPolygon=>({type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]});
const layer=(cells:LandLayer['cells']):LandLayer=>({id:'worldcover',status:'available',provider:'Synthetic test',product:'Native-grid fixture',version:'test',referencePeriod:null,observedAt:null,acquiredAt:new Date().toISOString(),resolutionM:10,crs:'EPSG:4326',cells,reason:null,assets:[],limitations:['Synthetic, not field validation']});
test('spherical surface matches an analytic rectangle and is invariant when sloping edges are subdivided',()=>{
 const r=rect(1.3,6.2,.001,.002),R=6371008.8,rad=Math.PI/180;
 const reference=R*R*.001*rad*(Math.sin(6.202*rad)-Math.sin(6.2*rad));assert.ok(Math.abs(sphericalRingAreaM2(r.coordinates[0])-reference)<1e-5);
 const g=polygonFromPoints([[1.3,6.2],[1.302,6.20007],[1.3018,6.203],[1.3002,6.2027]]),ring=g.coordinates[0],dense:Position[]=[];
 for(let i=0;i<ring.length-1;i++)for(let j=0;j<100;j++)dense.push([ring[i][0]+(ring[i+1][0]-ring[i][0])*j/100,ring[i][1]+(ring[i+1][1]-ring[i][1])*j/100]);dense.push(dense[0]);
 assert.ok(Math.abs(sphericalRingAreaM2(ring)-sphericalRingAreaM2(dense))<1e-5);assert.equal(parcelMetrics(g).areaM2,multiArea([g.coordinates]));
});
/** Deterministic synthetic grid. The old implementation failed at case 2
 * (non-additive spherical approximation) and case 10 (ring recursion overflow). */
export function fragmentedCases(count=60){let seed=58761;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const cases=[];
 for(let n=0;n<count;n++){const x=[1.3,2.2,-1.2,-.2,-5.4,-15.7][n%6]+rnd()*.001,y=[6.2,6.5,12.3,7,7.1,16.2][n%6]+rnd()*.001,w=.00006+rnd()*.003,h=.00006+rnd()*.003;
  const geometry=polygonFromPoints([[x,y],[x+w,y+h*.03],[x+w*.9,y+h],[x+w*.1,y+h*.9]]),cells:LandLayer['cells']=[];
  for(let row=0;row<8;row++)for(let col=0;col<8;col++)cells.push({id:`${row}:${col}`,value:[40,80,90,50][Math.floor(rnd()*4)],geometry:rect(x+col*w/8,y+row*h/8,w/8,h/8)});
  cases.push({geometry,layer:layer(cells)});
 }return cases;
}
test('fragmented native classes and sloped boundaries reconcile in all six countries, with disjoint outputs',()=>{
 for(const [index,{geometry,layer}] of fragmentedCases().entries()){
  const a=assessLandGeometry(geometry,[layer]),total=Object.values(a.fractions).reduce((n,f)=>n+f.areaM2,0),tolerance=Math.max(.001,a.areaM2*1e-7);
  assert.equal(a.areaMethod,AREA_METHOD);assert.ok(Math.abs(total-a.areaM2)<=tolerance);assert.ok(a.candidateAreaM2>0);assert.ok(a.excludedAreaM2>0);
  if(index<6){const fs=Object.values(a.fractions);for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++)assert.ok(multiArea(intersection(fs[i].geometry.coordinates,fs[j].geometry.coordinates))<=tolerance);}
 }
});
test('partition resource failure returns an explicitly unknown contour, retaining source audit and no cultivated surface',()=>{
 const g=rect(1.3,6.2,.001,.001),source=layer(Array.from({length:30001},(_,i)=>({id:String(i),geometry:g,value:40})));
 const a=partitionLandSafely(g,[source],new Date().toISOString());assert.equal(a.status,'unknown');assert.equal(a.analysis?.code,'LAND_PARTITION_FAILED');assert.equal(a.candidateAreaM2,0);assert.equal(a.unknownAreaM2,a.areaM2);assert.equal(a.sources[0].status,'available');assert.match(a.messages.join(' '),/inconnu/);
});
