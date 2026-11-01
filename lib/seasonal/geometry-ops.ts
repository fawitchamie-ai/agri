/** Computational grid only: 1e-12 degree (~0.00011 mm at the equator), far
 * below source pixel precision. Snap shared boundaries consistently before and
 * after decimal clipping. Do not use polyclip's epsilon: its orientation test
 * uses squared distances, so the same number is not a coordinate tolerance.
 * Area reconciliation remains max(0.001 m², total × 1e-7), unchanged. */
import * as clip from 'polyclip-ts';
import type {Position} from './parcel.ts';
export const COORDINATE_EPSILON_DEG=1e-12;
const SCALE=1/COORDINATE_EPSILON_DEG;
type MP=Position[][][];
function ring(points:Position[]):Position[]{
 const result:Position[]=[];
 for(const [x,y] of points){const p:Position=[Math.round(x*SCALE)/SCALE,Math.round(y*SCALE)/SCALE],last=result.at(-1);if(!last||p[0]!==last[0]||p[1]!==last[1])result.push(p);}
 if(result.length&&result[0].some((n,i)=>n!==result.at(-1)![i]))result.push([...result[0]]);
 return new Set(result.slice(0,-1).map(p=>p.join(','))).size>=3?result:[];
}
function snap(g:clip.Geom):MP{
 if(!g.length)return [];
 const polygons=(typeof g[0]?.[0]?.[0]==='number'?[g]:g) as MP;
 return polygons.flatMap(p=>{const outer=ring(p[0]);return outer.length?[[outer,...p.slice(1).map(ring).filter(r=>r.length)]]:[];});
}
export const union=(g:clip.Geom,...more:clip.Geom[])=>snap(clip.union(snap(g),...more.map(snap)));
export const intersection=(g:clip.Geom,...more:clip.Geom[])=>snap(clip.intersection(snap(g),...more.map(snap)));
export const difference=(g:clip.Geom,...more:clip.Geom[])=>snap(clip.difference(snap(g),...more.map(snap)));
