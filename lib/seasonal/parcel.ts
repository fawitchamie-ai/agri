/** WGS84 GeoJSON, longitude first. Spherical surface: R=6371008.8 m.
 * Drawing is a user estimate, not a cadastral survey. No raster precision claim. */
export type Position = [number, number];
export type ParcelPolygon = {type:'Polygon';coordinates:Position[][]};
const R=6371008.8, rad=Math.PI/180;
const equal=(a:Position,b:Position)=>a[0]===b[0]&&a[1]===b[1];
function cross(a:Position,b:Position,c:Position){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function on(a:Position,b:Position,p:Position){return Math.abs(cross(a,b,p))<1e-14&&p[0]>=Math.min(a[0],b[0])-1e-12&&p[0]<=Math.max(a[0],b[0])+1e-12&&p[1]>=Math.min(a[1],b[1])-1e-12&&p[1]<=Math.max(a[1],b[1])+1e-12;}
function intersects(a:Position,b:Position,c:Position,d:Position){
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 return ab1*ab2<0&&cd1*cd2<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
export function containsPoint(ring:Position[],p:Position):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i];if(on(a,b,p))return true;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export function distanceM(a:Position,b:Position){const dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad;const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
export function parcelMetrics(shape:ParcelPolygon){
 const ring=shape.coordinates[0],pts=ring.slice(0,-1);let sum=0,perimeterM=0,crossSum=0,cx=0,cy=0;
 // Shift to local origin before calculating a centroid, to retain precision at m² scale.
 const origin=pts[0];
 for(let i=0;i<pts.length;i++){
  const a=pts[i],b=pts[(i+1)%pts.length];sum+=(b[0]-a[0])*rad*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad));perimeterM+=distanceM(a,b);
  const ax=a[0]-origin[0],ay=a[1]-origin[1],bx=b[0]-origin[0],by=b[1]-origin[1],c=ax*by-bx*ay;crossSum+=c;cx+=(ax+bx)*c;cy+=(ay+by)*c;
 }
 const centroid:Position=crossSum?[origin[0]+cx/(3*crossSum),origin[1]+cy/(3*crossSum)]:origin;
 const point=containsPoint(ring,centroid)?centroid:[...origin] as Position;
 return {areaM2:Math.abs(sum)*R*R/2,perimeterM,point,pointIsCentroid:equal(point,centroid)};
}
export function polygonFromPoints(points:Position[]):ParcelPolygon{
 return validateParcel({type:'Polygon',coordinates:[[...points,points[0]]]});
}
export function validateParcel(value:unknown):ParcelPolygon{
 const v=value as ParcelPolygon;
 if(!v||v.type!=='Polygon'||!Array.isArray(v.coordinates)||v.coordinates.length!==1)throw new Error('Un seul contour GeoJSON Polygon, sans trou, est attendu.');
 const ring=v.coordinates[0];
 if(!Array.isArray(ring)||ring.length<4||ring.length>201)throw new Error('Placez entre 3 et 200 points pour définir la parcelle.');
 const clean:Position[]=ring.map(p=>{
  if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n))||p[0]<-180||p[0]>180||p[1]<-85||p[1]>85)throw new Error('Coordonnées WGS84 invalides : longitude, puis latitude.');
  return [p[0],p[1]];
 });
 if(!equal(clean[0],clean.at(-1)!))throw new Error('Le contour de la parcelle doit être fermé.');
 const points=clean.slice(0,-1),n=points.length;
 if(new Set(points.map(p=>p.join(','))).size!==n)throw new Error('Deux sommets de la parcelle sont identiques.');
 if(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))>2||Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))>2)throw new Error('Le tracé est trop étendu pour une parcelle : rapprochez les points.');
 for(let i=0;i<n;i++){
  if(Math.abs(cross(points[(i+n-1)%n],points[i],points[(i+1)%n]))<1e-14)throw new Error('Trois sommets consécutifs sont alignés : retirez le point intermédiaire.');
  for(let j=i+1;j<n;j++)if(j!==i+1&&!(i===0&&j===n-1)&&intersects(points[i],points[(i+1)%n],points[j],points[(j+1)%n]))throw new Error('Les limites se croisent : déplacez ou retirez un point.');
 }
 const polygon:ParcelPolygon={type:'Polygon',coordinates:[clean]},m=parcelMetrics(polygon);
 if(m.areaM2<1||m.areaM2>1e9)throw new Error('La surface doit être comprise entre 1 m² et 100 000 hectares.');
 return polygon;
}
export const COUNTRY_VIEWS={
 TGO:{center:[1.1,8.65] as Position,zoom:6.6,iso2:'TG'},BEN:{center:[2.3,9.3] as Position,zoom:6.3,iso2:'BJ'},
 GHA:{center:[-1.05,7.95] as Position,zoom:6.2,iso2:'GH'},BFA:{center:[-1.7,12.35] as Position,zoom:6.1,iso2:'BF'},
 CIV:{center:[-5.55,7.55] as Position,zoom:6.1,iso2:'CI'},SEN:{center:[-14.5,14.45] as Position,zoom:6.3,iso2:'SN'},
};
