import * as clipping from './geometry-ops.ts';
import {multiArea,terrestrialSoilPoint,type LandAssessment,type MultiShape} from './land.ts';
import {loadSoil,type SoilEstimate} from './environment.ts';
import {geometryIdentity} from './provenance.ts';

const SOIL_PROPERTIES=[
 {key:'organicC',label:'Carbone organique (SOC)',unit:'g/kg'},
 {key:'organicCarbonDensity',label:'Densité de carbone organique',unit:'kg/m³'},
 {key:'organicCarbonStock',label:'Stock de carbone organique',unit:'kg/m²'},
 {key:'totalN',label:'Azote total',unit:'g/kg'},
 {key:'cec',label:'Capacité d’échange cationique',unit:'cmol(+)/kg'},
 {key:'bulkDensity',label:'Densité apparente',unit:'kg/dm³'},
 {key:'coarseFragments',label:'Éléments grossiers',unit:'% vol.'},
 {key:'sand',label:'Sable',unit:'%'},{key:'silt',label:'Limon',unit:'%'},{key:'clay',label:'Argile',unit:'%'},
 {key:'waterContent10kPa',label:'Eau volumique à 10 kPa',unit:'m³/m³'},
] as const;
export async function sampleParcelSoil(a:LandAssessment,fetcher:typeof fetch=fetch){
 const land=a.fractions.potentialLand.geometry.coordinates,parts:MultiShape[]=[];
 for(const polygon of land){
  const pts=polygon[0],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),w=Math.min(...xs),e=Math.max(...xs),s=Math.min(...ys),n=Math.max(...ys),m=(w+e)/2;
  for(const [left,right] of a.candidateAreaM2>62500?[[w,m],[m,e]]:[[w,e]]){
   const rect=[[[left,s],[right,s],[right,n],[left,n],[left,s]]] as MultiShape['coordinates'][number];const cut=clipping.intersection([polygon],[rect]);if(cut.length)parts.push({type:'MultiPolygon',coordinates:cut});
  }
 }
 const samples:{geometry:MultiShape;point:ReturnType<typeof terrestrialSoilPoint>;areaM2:number;soil:SoilEstimate|null}[]=[];for(const geometry of parts.slice(0,8)){
  const point=terrestrialSoilPoint({fractions:{potentialLand:{geometry}}} as LandAssessment);
  const soil=point?await loadSoil(point[1],point[0],fetcher):null;samples.push({geometry,point,areaM2:multiArea(geometry.coordinates),soil});
 }
 const coveredM2=samples.filter(s=>s.soil?.hydraulicLayers).reduce((n,s)=>n+s.areaM2,0),tolerance=Math.max(.001,a.areaM2*1e-7);
 const summary=SOIL_PROPERTIES.map(p=>{const rows=samples.filter(s=>s.soil&&typeof (s.soil as any)[p.key]==='number');const areaM2=rows.reduce((n,s)=>n+s.areaM2,0);return {key:p.key,label:p.label,unit:p.unit,value:areaM2?rows.reduce((n,s)=>n+(s.soil as any)[p.key]*s.areaM2,0)/areaM2:null,coveredM2:areaM2,coverageFraction:a.candidateAreaM2>0?areaM2/a.candidateAreaM2:0};});
 const availableWaterRows=samples.filter(s=>s.soil?.hydraulicLayers?.length);const availableWaterMm=coveredM2?availableWaterRows.reduce((n,s)=>n+s.soil!.hydraulicLayers!.reduce((m,l)=>m+1000*l.thicknessM*(l.thetaFC-l.thetaWP),0)*s.areaM2,0)/coveredM2:null;
 return {version:'spatial-soil-1',geometryId:geometryIdentity(a.geometry),totalM2:a.candidateAreaM2,coveredM2,complete:Math.abs(coveredM2-a.candidateAreaM2)<=tolerance,samples,summary,availableWaterMm,method:'Profils représentatifs des zones terrestres, pondérés par leur aire ; ce n’est pas une statistique exhaustive de chaque pixel SoilGrids.',nativeResolutionM:250,limits:['Jusqu’à huit profils par requête ; la couverture et l’aire de chaque valeur sont affichées.','Maille native de 250 m : l’agrégation au contour ne crée pas une précision sous-pixel. Plusieurs zones peuvent partager une maille.','Les valeurs générales décrivent 5–15 cm ; les horizons hydriques décrivent 0–200 cm. pH affiché par zone, sans moyenne arithmétique.','Les quantiles Q0.05–Q0.95 sont des intervalles prédictifs SoilGrids par valeur, pas un intervalle de confiance de la moyenne de parcelle.','Les propriétés de carte ne remplacent pas un prélèvement de sol. Les profils de laboratoire compatibles priment.']};
}
