import {assessLandGeometry,bbox,clipToParcel,multiArea,missingLandLayer,type LandLayer,type LandAssessment} from './land.ts';
import {readRasterWindow} from './raster.ts';
import {validateParcel,type ParcelPolygon} from './parcel.ts';
import {geometryIdentity} from './provenance.ts';

export const WORLD_COVER='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/';
export const JRC_SEASONALITY='https://s3.waw4-1.cloudferro.com/swift/v1/global-surface-water/download2024/Aggregated/VER1-5/seasonality/';
const tileName=(n:number,pos:string,neg:string,pad=2)=>(n<0?neg:pos)+String(Math.abs(n)).padStart(pad,'0');
export function worldCoverAssets(shape:ParcelPolygon):string[]{
  const [west,south,east,north]=bbox(shape),urls:string[]=[];
  for(let lat=Math.floor(south/3)*3;lat<north;lat+=3)for(let lon=Math.floor(west/3)*3;lon<east;lon+=3)urls.push(`${WORLD_COVER}ESA_WorldCover_10m_2021_v200_${tileName(lat,'N','S')}${tileName(lon,'E','W',3)}_Map.tif`);
  if(urls.length>4)throw new Error('Contour réparti sur trop de tuiles : découpez-le.');return urls;
}
export function jrcAssets(shape:ParcelPolygon):string[]{
  const [west,south,east,north]=bbox(shape),urls:string[]=[];
  for(let top=Math.floor(south/10)*10+10;top<north+10;top+=10)for(let left=Math.floor(west/10)*10;left<east;left+=10){
    const lon=`${Math.abs(left)}${left<0?'W':'E'}`,lat=`${Math.abs(top)}${top<0?'S':'N'}`;
    urls.push(`${JRC_SEASONALITY}seasonality_${lon}_${lat}_v1_5_2024.tif`);
  }
  if(urls.length>4)throw new Error('Contour réparti sur trop de tuiles JRC.');return urls;
}
async function staticLayer(id:'worldcover'|'jrc',shape:ParcelPolygon,fetcher:typeof fetch,now:string):Promise<LandLayer>{
  const base:LandLayer={...missingLandLayer(id,'',now),status:'available',referencePeriod:{from:id==='worldcover'?'2021-01-01':'2024-01-01',to:id==='worldcover'?'2021-12-31':'2024-12-31'},
    resolutionM:id==='worldcover'?10:30,crs:'EPSG:4326',limitations:id==='worldcover'?['Occupation du sol 2021, pas observation actuelle.','Erreur de classification et pixels mixtes ; qualité InputQuality non acquise, à vérifier au terrain.']:['Saisonnalité 2024 ; douze mois signifie eau permanente dans ce produit.','Le produit ne mesure ni hauteur d’eau ni état présent. Décalages de co-enregistrement possibles.','La couche Monthly Recurrence signalée défectueuse par le JRC n’est pas utilisée.']};
  base.assets=id==='worldcover'?worldCoverAssets(shape):jrcAssets(shape);
  const results=await Promise.allSettled(base.assets.map(u=>readRasterWindow(u,shape,fetcher,AbortSignal.timeout(50000),[0],true)));
  for(const r of results)if(r.status==='fulfilled')base.cells.push(...r.value.cells);else base.limitations.push(String(r.reason?.message??r.reason));
  base.cells=base.cells.map(c=>({...c,rawValue:c.value,value:c.value!==null&&(id==='worldcover'?[10,20,30,40,50,60,70,80,90,95,100].includes(c.value):Number.isInteger(c.value)&&c.value>=0&&c.value<=12)?c.value:null}));
  if(id==='worldcover'&&base.cells.some(c=>c.value!==null)){
    const assets=base.assets.map(u=>u.replace('/map/','/inputquality/').replace('_Map.tif','_InputQuality.tif'));
    const quality=await Promise.allSettled(assets.map(u=>readRasterWindow(u,shape,fetcher,AbortSignal.timeout(15000),[0,1,2],true)));
    const windows=quality.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
    const cells=windows.flatMap(w=>w.cells).filter(c=>c.bands?.length===3&&c.value!==null);
    base.quality={status:cells.length?'available':'missing',resolutionM:windows[0]?.resolutionM??null,coveredAreaM2:cells.reduce((n,c)=>n+multiArea(clipToParcel(shape,c.geometry).coordinates),0),assets,reason:cells.length?null:'InputQuality non accessible sur les actifs publics essayés ; aucune qualité de pixel inventée.',observations:cells.map(c=>({cell:c.id,s1:c.bands![0],s2:c.bands![1],invalidS2Percent:c.bands![2]}))};
    base.qualityMask={type:'MultiPolygon',coordinates:cells.filter(c=>c.bands![0]===0&&c.bands![1]===0||c.bands!.some(n=>!Number.isFinite(n)||n<0)||c.bands![2]>100).flatMap(c=>clipToParcel(shape,c.geometry).coordinates)};
    base.limitations=base.limitations.filter(s=>!s.includes('InputQuality non acquise'));
    base.limitations.push('InputQuality décrit les observations EO sources, pas la probabilité de bonne classification ; sa résolution propre est conservée.');
    if(base.quality.status==='missing')base.limitations.push(base.quality.reason!);
  }
  if(!base.cells.some(c=>c.value!==null))return {...base,status:'missing',reason:'Aucun pixel valide récupéré ; source inaccessible, hors couverture ou sans donnée.'};
  return base;
}
async function recentLayer(shape:ParcelPolygon,fetcher:typeof fetch,now:string):Promise<LandLayer>{
  const empty=missingLandLayer('recent','Aucune observation récente exploitable.',now);
  const from=new Date(Date.parse(now)-90*86400000).toISOString(),url=new URL('https://explorer.digitalearth.africa/stac/search');
  url.search=new URLSearchParams({collections:'wofs_ls',bbox:bbox(shape).join(','),datetime:`${from}/${now}`,limit:'5'}).toString();
  try{
    const res=await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'manual'});
    if(!res.ok||!res.headers.get('content-type')?.includes('json')){
      await res.body?.cancel();
      throw new Error(`Catalogue WOfS indisponible (HTTP ${res.status}) ou réponse non JSON ; aucune redirection suivie.`);
    }
    type Item={id?:string;properties?:{datetime?:string};assets?:Record<string,{href?:string}>};
    const data=await res.json() as {features?:Item[]};
    if(!Array.isArray(data.features))throw new Error('Catalogue WOfS invalide.');
    const items=data.features.filter(f=>typeof f.properties?.datetime==='string'&&f.properties.datetime>=from&&f.properties.datetime<=now).sort((a,b)=>b.properties!.datetime!.localeCompare(a.properties!.datetime!));
    for(const item of items){
      const href=item.assets?.water?.href;if(typeof href!=='string')continue;
      const asset=href.startsWith('s3://deafrica-services/')?href.replace('s3://deafrica-services/','https://deafrica-services.s3.af-south-1.amazonaws.com/'):href;
      try{
        const raster=await readRasterWindow(asset,shape,fetcher,AbortSignal.timeout(50000),[0],true);
        const clear=raster.cells.filter(c=>c.value===0||c.value===128);
        if(!clear.length)continue;
        return {...empty,status:'available',version:item.id??'item non versionné',observedAt:item.properties!.datetime!,referencePeriod:{from:item.properties!.datetime!,to:item.properties!.datetime!},resolutionM:raster.resolutionM,crs:raster.crs,cells:raster.cells,assets:[asset],reason:null,limitations:['Pixels avec drapeaux de nuage, ombre, pente ou absence de donnée : inconnus.','Une observation sèche ne prouve pas le drainage, ni l’absence d’eau sous végétation.','Dernière scène disponible parmi les cinq résultats du catalogue ; pas une couverture quotidienne.']};
      }catch{continue;}
    }
    return empty;
  }catch(e){return {...empty,reason:(e as Error).message};}
}
const cache=new Map<string,{until:number;value:LandAssessment}>();
const inflight=new Map<string,Promise<LandAssessment>>();
export async function loadLandAssessment(input:unknown,fetcher:typeof fetch=fetch,now=new Date().toISOString(),refresh=false):Promise<LandAssessment>{
  const shape=validateParcel(input),key=JSON.stringify([LAND_SOURCES,geometryIdentity(shape),now.slice(0,10)]);
  const found=fetcher===fetch?cache.get(key):undefined;if(!refresh&&found&&found.until>Date.now())return structuredClone(found.value);
  if(fetcher===fetch&&inflight.has(key))return structuredClone(await inflight.get(key)!);
  const task=(async()=>{
    const results=await Promise.allSettled([staticLayer('worldcover',shape,fetcher,now),staticLayer('jrc',shape,fetcher,now),recentLayer(shape,fetcher,now)]);
    const ids=['worldcover','jrc','recent'] as const;
    const layers=results.map((r,i)=>r.status==='fulfilled'?r.value:missingLandLayer(ids[i],String(r.reason?.message??r.reason),now));
    const result=assessLandGeometry(shape,layers,now);
    if(fetcher===fetch){if(cache.size>=16)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+(layers.some(l=>l.id==='worldcover'&&l.status==='missing')?60000:1800000),value:result});}
    return result;
  })();
  if(fetcher===fetch)inflight.set(key,task);
  try{return structuredClone(await task);}finally{if(fetcher===fetch)inflight.delete(key);}
}
const LAND_SOURCES='WorldCover2021v200+JRC1.5seasonality2024+WOfS90days+nativeRectangles2';
