import {satelliteMapUrl} from './satellite.ts';
const pixel=(p:number[],z:number)=>{const s=256*2**z,lat=p[1]*Math.PI/180;return [(p[0]+180)/360*s,(1-Math.asinh(Math.tan(lat))/Math.PI)/2*s];};
/** Esri's existing public tile endpoint; no export request, proxy or new recipient. */
export function basemapTilePlan(bounds:number[],zoomOffset=0){
 satelliteMapUrl('rgb','2026-01-01',bounds);
 if(![0,-1,-2].includes(zoomOffset))throw new Error('Niveau de repérage invalide.');
 const centerLat=(bounds[1]+bounds[3])/2,widthM=(bounds[2]-bounds[0])*111320*Math.cos(centerLat*Math.PI/180);
 let z=Math.max(0,Math.min(19,Math.floor(Math.log2(156543.033928*Math.cos(centerLat*Math.PI/180)/(widthM/1024)))+zoomOffset));
 let a=pixel([bounds[0],bounds[3]],z),b=pixel([bounds[2],bounds[1]],z);
 const count=()=> (Math.ceil(b[0]/256)-Math.floor(a[0]/256))*(Math.ceil(b[1]/256)-Math.floor(a[1]/256));
 while(count()>30&&z>0){z--;a=pixel([bounds[0],bounds[3]],z);b=pixel([bounds[2],bounds[1]],z);}
 const tiles=[];
 for(let y=Math.floor(a[1]/256);y<Math.ceil(b[1]/256);y++)for(let x=Math.floor(a[0]/256);x<Math.ceil(b[0]/256);x++){
  const latitude=(v:number)=>Math.atan(Math.sinh(Math.PI*(1-2*v/2**z)))*180/Math.PI;
  const north=latitude(y),south=latitude(y+1);
  tiles.push({id:z+'/'+y+'/'+x,src:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+y+'/'+x,
   left:(x*256-a[0])/(b[0]-a[0])*100,top:(bounds[3]-north)/(bounds[3]-bounds[1])*100,width:256/(b[0]-a[0])*100,height:(north-south)/(bounds[3]-bounds[1])*100});
 }
 return {z,tiles};
}
export function framePoint(p:number[],bounds:number[],mercator=false){
 if(mercator){const a=pixel([bounds[0],bounds[3]],0),b=pixel([bounds[2],bounds[1]],0),v=pixel(p,0);return [(v[0]-a[0])/(b[0]-a[0])*640,(v[1]-a[1])/(b[1]-a[1])*400];}
 return [(p[0]-bounds[0])/(bounds[2]-bounds[0])*640,(bounds[3]-p[1])/(bounds[3]-bounds[1])*400];
}
/** Alpha coverage is displayed-data coverage, never a claim of clear sky or crop health. */
export function parcelImageCoverage(rgba:Uint8ClampedArray|Uint8Array,width:number,height:number,rings:number[][][]){
 const inRing=(x:number,y:number,r:number[][])=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 let samples=0,visible=0;
 for(let y=1;y<height;y+=2)for(let x=1;x<width;x+=2){
  const px=x/width*640,py=y/height*400;
  if(!rings[0]||!inRing(px,py,rings[0])||rings.slice(1).some(r=>inRing(px,py,r)))continue;
  samples++;if(rgba[(y*width+x)*4+3]>0)visible++;
 }
 return {samples,percent:samples>=8?Math.round(visible/samples*100):null};
}
export function imageScale(bounds:number[]){
 const widthM=(bounds[2]-bounds[0])*111320*Math.cos((bounds[1]+bounds[3])/2*Math.PI/180);
 const meters=[10,20,50,100,200,500,1000,2000,5000,10000].filter(x=>x<=widthM/4).at(-1)??10;
 return {meters,pixels:meters/widthM*640};
}
