import clipping from 'polygon-clipping';
import {multiArea,terrestrialSoilPoint,type LandAssessment,type MultiShape} from './land.ts';
import {loadSoil} from './environment.ts';
import {geometryIdentity} from './provenance.ts';
export async function sampleParcelSoil(a:LandAssessment,fetcher:typeof fetch=fetch){
 const land=a.fractions.potentialLand.geometry.coordinates,parts:MultiShape[]=[];
 for(const polygon of land){
  const pts=polygon[0],xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),w=Math.min(...xs),e=Math.max(...xs),s=Math.min(...ys),n=Math.max(...ys),m=(w+e)/2;
  for(const [left,right] of a.candidateAreaM2>62500?[[w,m],[m,e]]:[[w,e]]){
   const rect=[[[left,s],[right,s],[right,n],[left,n],[left,s]]] as MultiShape['coordinates'][number];const cut=clipping.intersection([polygon],[rect]);if(cut.length)parts.push({type:'MultiPolygon',coordinates:cut});
  }
 }
 const samples=[];for(const geometry of parts.slice(0,8)){
  const point=terrestrialSoilPoint({fractions:{potentialLand:{geometry}}} as LandAssessment);
  const soil=point?await loadSoil(point[1],point[0],fetcher):null;samples.push({geometry,point,areaM2:multiArea(geometry.coordinates),soil});
 }
 const coveredM2=samples.filter(s=>s.soil?.hydraulicLayers).reduce((n,s)=>n+s.areaM2,0),tolerance=Math.max(.001,a.areaM2*1e-7);
 return {version:'spatial-soil-1',geometryId:geometryIdentity(a.geometry),totalM2:a.candidateAreaM2,coveredM2,complete:Math.abs(coveredM2-a.candidateAreaM2)<=tolerance,samples,method:'Échantillons dans les composantes terrestres et deux strates des grands polygones ; pondération de surface, pas intégration exhaustive des pixels.',nativeResolutionM:250,limits:['Huit profils maximum par requête ; couverture partielle signalée sans extrapolation.','Deux points peuvent partager un pixel natif. Variabilité entre points inconnue.','Le pH n’est pas moyenné. Les profils de laboratoire compatibles priment.']};
}
