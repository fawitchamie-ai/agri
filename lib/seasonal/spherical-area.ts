/** R = 6 371 008.8 m; edges are straight in longitude/latitude, exactly as
 * polygon-clipping treats them. Integrate sin(latitude) along each edge rather
 * than using the endpoint trapezoid: that approximation changes when clipping
 * inserts collinear vertices. A local latitude origin and compensated sum keep
 * small parcels stable. This is not a geodesic/cadastral survey. */
import type {Position} from './parcel.ts';
export const AREA_METHOD='spherical-linear-edges-1';
const R=6371008.8,rad=Math.PI/180;
export function sphericalRingAreaM2(ring:Position[]):number{
 if(ring.length<4)return 0;
 const latitude0=ring[0][1],phi0=latitude0*rad;
 let sum=0,correction=0;
 for(let i=0;i<ring.length-1;i++){
  const a=ring[i],b=ring[i+1],midOffset=((a[1]-latitude0)+(b[1]-latitude0))*rad/2,half=(b[1]-a[1])*rad/2;
  const h2=half*half;
  const sincMinusOne=Math.abs(half)<.1?-h2/6+h2*h2/120-h2*h2*h2/5040+h2*h2*h2*h2/362880:Math.sin(half)/half-1;
  const meanSinOffset=2*Math.cos(phi0+midOffset/2)*Math.sin(midOffset/2)+Math.sin(phi0+midOffset)*sincMinusOne;
  const term=(b[0]-a[0])*rad*meanSinOffset,adjusted=term-correction,next=sum+adjusted;
  correction=(next-sum)-adjusted;sum=next;
 }
 return Math.abs(sum)*R*R;
}
