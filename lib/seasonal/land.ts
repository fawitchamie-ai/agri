import clipping from 'polygon-clipping';
import {validateParcel,parcelMetrics,type ParcelPolygon,type Position} from './parcel.ts';
import {scopeId,geometryIdentity} from './provenance.ts';

export const LAND_VERSION='land-1' as const;
export type LandClass='permanentWater'|'seasonalWater'|'wetland'|'incompatible'|'potentialLand'|'unknown';
export const LAND_CLASSES:LandClass[]=['permanentWater','seasonalWater','wetland','incompatible','potentialLand','unknown'];
export type MultiShape={type:'MultiPolygon';coordinates:Position[][][]};
export type RasterCell={geometry:ParcelPolygon;value:number|null;rawValue?:number|null;id:string;bands?:number[]};
export type LandLayer={
  id:'worldcover'|'jrc'|'recent';status:'available'|'missing';provider:string;product:string;version:string;
  referencePeriod:{from:string;to:string}|null;observedAt:string|null;acquiredAt:string;resolutionM:number|null;crs:string|null;
  cells:RasterCell[];reason:string|null;assets:string[];limitations:string[];
  quality?:{status:'available'|'missing';resolutionM:number|null;coveredAreaM2:number;assets:string[];reason:string|null;observations:{cell:string;s1:number;s2:number;invalidS2Percent:number}[]};
  qualityMask?:MultiShape;
};
export type LandAssessment={
  version:typeof LAND_VERSION;scopeId:string;geometry:ParcelPolygon;assessedAt:string;
  areaM2:number;fractions:Record<LandClass,{areaM2:number;fraction:number;geometry:MultiShape}>;
  sources:Omit<LandLayer,'cells'>[];status:'excluded'|'mixed'|'conditional'|'unknown';
  candidateAreaM2:number;excludedAreaM2:number;unknownAreaM2:number;
  messages:string[];boundaryUncertaintyM:number|null;legalStatus:'not_assessed';
};
type MP=Position[][][];
const rectangle=(g:ParcelPolygon)=>g.coordinates as clipping.Polygon;
const intersect=(a:MP,b:MP)=>clipping.intersection(a,b) as MP;
const difference=(a:MP,b:MP)=>b.length?clipping.difference(a,b) as MP:a;
function ringArea(ring:Position[]):number {
  let sum=0;const rad=Math.PI/180,R=6371008.8;
  for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1];sum+=(b[0]-a[0])*rad*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad));}
  return Math.abs(sum)*R*R/2;
}
export function multiArea(shape:MP):number{return shape.reduce((n,p)=>n+Math.max(0,ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0)),0);}
export function clipToParcel(shape:ParcelPolygon,cell:ParcelPolygon):MultiShape{return {type:'MultiPolygon',coordinates:intersect([shape.coordinates],[cell.coordinates])};}
export function bbox(shape:ParcelPolygon):[number,number,number,number]{const p=shape.coordinates.flat();return [Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))];}
export function missingLandLayer(id:LandLayer['id'],reason:string,now:string):LandLayer {
  return {id,status:'missing',provider:id==='worldcover'?'ESA':id==='jrc'?'EC JRC / Google':'Digital Earth Africa',product:id==='worldcover'?'WorldCover':id==='jrc'?'Global Surface Water':'WOfS',version:id==='worldcover'?'2021-v200':id==='jrc'?'1.5-2024':'unknown',referencePeriod:null,observedAt:null,acquiredAt:now,resolutionM:null,crs:null,cells:[],reason,assets:[],limitations:[]};
}
function wcClass(v:number|null):LandClass {
  if(v===80)return 'permanentWater'; // WorldCover definition: permanent water bodies (historical 2021).
  if(v===90||v===95)return 'wetland';
  if(v===50||v===70)return 'incompatible';
  if(v!==null&&[10,20,30,40,60,100].includes(v))return 'potentialLand';
  return 'unknown';
}
function layerClass(id:LandLayer['id'],v:number|null):LandClass|null {
  if(id==='worldcover')return wcClass(v);
  if(id==='jrc')return v===12?'permanentWater':v!==null&&v>=1&&v<=11?'seasonalWater':null;
  // WOfS bit field: only dry=0/wet=128 are clear observations. Invalid bits never mean dry.
  return v===128?'seasonalWater':null;
}

/** Exact polygon/cell intersections; no centre-point voting or upsampled pixels. */
export function assessLandGeometry(input:unknown,layers:LandLayer[],now=new Date().toISOString()):LandAssessment {
  const geometry=validateParcel(input),whole=[geometry.coordinates] as MP,areaM2=parcelMetrics(geometry).areaM2;
  if(layers.reduce((n,l)=>n+l.cells.length,0)>30000)throw new Error('Analyse trop étendue : découpez la parcelle en secteurs.');
  const parts:Record<LandClass,MP>={permanentWater:[],seasonalWater:[],wetland:[],incompatible:[],potentialLand:[],unknown:whole};
  // Baseline first; current water adds a constraint, never clears historical water.
  for(const layer of layers.filter(l=>l.status==='available').sort((a,b)=>['worldcover','jrc','recent'].indexOf(a.id)-['worldcover','jrc','recent'].indexOf(b.id))){
    const groups:Partial<Record<LandClass,MP[]>>={};
    if(layer.id==='jrc'&&parts.permanentWater.length){
      // A later dry classification contradicts the historical permanent-water
      // baseline; it triggers review rather than an automatic land approval.
      const dry=layer.cells.filter(c=>c.value===0).map(c=>[c.geometry.coordinates] as MP);
      for(const piece of dry){if(!parts.permanentWater.length)break;const disputed=intersect(parts.permanentWater,piece);parts.permanentWater=difference(parts.permanentWater,disputed);parts.unknown=clipping.union(parts.unknown,disputed) as MP;}
    }
    for(const cell of layer.cells){const cls=layerClass(layer.id,cell.value);if(!cls||cls==='unknown')continue;const cut=intersect(whole,[rectangle(cell.geometry)] as MP);if(cut.length)(groups[cls]??=[]).push(cut);}
    for(const [cls,items] of Object.entries(groups) as [LandClass,MP[]][]){
      // Merge adjacent cell pieces in bounded batches to avoid huge call stacks.
      let joined:MP=[];
      for(let i=0;i<items.length;i+=64)joined=clipping.union(joined,...items.slice(i,i+64)) as MP;
      if(!joined.length)continue;
      if(layer.id!=='worldcover'){
        // Existing permanent water/built areas stay excluded; recent dry is not proof of drainage.
        joined=difference(joined,layer.id==='jrc'&&cls==='seasonalWater'?parts.incompatible:clipping.union(parts.permanentWater,parts.incompatible) as MP);
      }
      for(const k of LAND_CLASSES)if(k!==cls)parts[k]=difference(parts[k],joined);
      parts[cls]=clipping.union(parts[cls],joined) as MP;
    }
    if(layer.qualityMask?.coordinates.length){
      const mask=intersect(whole,layer.qualityMask.coordinates);
      for(const k of LAND_CLASSES)if(k!=='unknown')parts[k]=difference(parts[k],mask);
      parts.unknown=clipping.union(parts.unknown,mask) as MP;
    }
  }
  const fractions={} as LandAssessment['fractions'];
  for(const k of LAND_CLASSES){const area=multiArea(parts[k]);fractions[k]={areaM2:area,fraction:area/areaM2,geometry:{type:'MultiPolygon',coordinates:parts[k]}};}
  const excludedAreaM2=fractions.permanentWater.areaM2+fractions.incompatible.areaM2;
  const candidateAreaM2=fractions.potentialLand.areaM2;
  const unknownAreaM2=fractions.unknown.areaM2;
  // Only numerical area tolerance; not a universal agronomic suitability threshold.
  const tolerance=Math.max(.001,areaM2*1e-7),messages:string[]=[];
  if(excludedAreaM2>tolerance)messages.push('Eau permanente ou surface incompatible cartographiée : cette partie est exclue du calcul terrestre standard.');
  if(fractions.wetland.areaM2>tolerance||fractions.seasonalWater.areaM2>tolerance)messages.push('Zone humide ou eau saisonnière : diagnostic de culture, saison, nappe et drainage nécessaire.');
  if(unknownAreaM2>tolerance)messages.push('Couverture inconnue : absence de classement ne signifie pas terre cultivable.');
  if(layers.some(l=>l.id==='jrc'&&l.status==='available'))messages.push('La saisonnalité JRC 2024 précise la classe historique de 2021 ; une contradiction eau permanente / sec reste à vérifier.');
  messages.push('Occupation historique et observations disponibles ; potentiel biophysique et droit de cultiver non établis. Une absence d’eau détectée ne prouve pas le drainage.');
  for(const l of layers)if(l.status==='missing')messages.push(`${l.product} indisponible : ${l.reason}`);
  return {version:LAND_VERSION,scopeId:scopeId(geometry),geometry,assessedAt:now,areaM2,fractions,
    sources:layers.map(({cells,...s})=>{void cells;return s;}),status:excludedAreaM2>=areaM2-tolerance?'excluded':excludedAreaM2>tolerance?'mixed':unknownAreaM2>=areaM2-tolerance?'unknown':'conditional',
    candidateAreaM2,excludedAreaM2,unknownAreaM2,messages,boundaryUncertaintyM:null,legalStatus:'not_assessed'};
}

export function landBlockReason(c:{parcelGeometry?:ParcelPolygon;landAssessment?:LandAssessment}):string|null {
  if(!c.parcelGeometry)return null; // Explicit non-geographic reference scenarios remain possible.
  const a=c.landAssessment;
  if(!a||a.version!==LAND_VERSION||a.scopeId!==scopeId(c.parcelGeometry)||geometryIdentity(a.geometry)!==geometryIdentity(c.parcelGeometry))return 'Analyse du contour non disponible : vérifier eau, zones humides et surface terrestre avant de calculer.';
  if(!Number.isFinite(Date.parse(a.assessedAt))||Date.now()-Date.parse(a.assessedAt)>86400000)return 'Analyse du contour à actualiser avant le calcul.';
  if(a.status==='excluded')return 'Parcelle située sur une surface en eau permanente ou incompatible : calcul terrestre suspendu.';
  if(a.excludedAreaM2>Math.max(.001,a.areaM2*1e-7))return 'Contour mixte : redessinez un secteur admissible parmi les parties affichées avant de calculer. La surface totale ne sera pas traitée comme cultivée.';
  if(a.unknownAreaM2>Math.max(.001,a.areaM2*1e-7))return 'Une partie du contour reste inconnue : vérification nécessaire avant un calcul sur toute la parcelle.';
  if(a.fractions.wetland.areaM2+a.fractions.seasonalWater.areaM2>Math.max(.001,a.areaM2*1e-7))return 'Zone humide ou eau saisonnière : le module terrestre générique est suspendu. Un diagnostic spécifique, notamment pour le riz, est nécessaire.';
  return null;
}

/** Sample inside mapped potential land, including concavities and holes. */
export function terrestrialSoilPoint(a:LandAssessment):Position|null {
  const polygons=a.fractions.potentialLand.geometry.coordinates;
  if(!polygons.length)return null;
  const polygon=polygons.reduce((best,p)=>multiArea([p])>multiArea([best])?p:best);
  const ys=polygon[0].map(p=>p[1]),south=Math.min(...ys),north=Math.max(...ys);
  let best:Position|null=null,width=0;
  for(const fraction of [.5,.25,.75]){
    const y=south+(north-south)*fraction,xs:number[]=[];
    for(const ring of polygon)for(let i=0;i<ring.length-1;i++){
      const p=ring[i],q=ring[i+1];
      if((p[1]>y)!==(q[1]>y))xs.push(p[0]+(y-p[1])*(q[0]-p[0])/(q[1]-p[1]));
    }
    xs.sort((x,y)=>x-y);
    for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>width){width=xs[i+1]-xs[i];best=[(xs[i]+xs[i+1])/2,y];}
  }
  return best;
}
