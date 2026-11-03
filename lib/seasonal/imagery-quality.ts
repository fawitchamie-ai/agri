/** Esri publishes the availability of each cached level. A 200 JPEG can otherwise
 * be a "Map data not yet available" placeholder, so HTTP success is insufficient. */
export const ESRI_IMAGERY='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
export async function availableImageryLevel(lng:number,lat:number,desired:number,signal?:AbortSignal,fetcher:typeof fetch=fetch){
 if(!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lng)>180||Math.abs(lat)>85||!Number.isInteger(desired)||desired<2||desired>23)throw new Error('Position d’imagerie invalide.');
 for(let z=desired;z>=Math.max(2,desired-7);z--){
  const count=2**z,x=Math.min(count-1,Math.floor((lng+180)/360*count)),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*count);
  const response=await fetcher(`${ESRI_IMAGERY}/tilemap/${z}/${y}/${x}/1/1?f=json`,{signal});
  if(!response.ok)throw new Error('Niveau de détail non vérifié.');
  const data=await response.json() as {valid?:boolean;data?:number[];location?:{top:number;left:number;width:number;height:number}};
  const location=data.location;
  if(data.valid!==true||!location||!Array.isArray(data.data))throw new Error('Disponibilité de l’image non vérifiée.');
  const dx=x-location.left,dy=y-location.top;
  if(dx<0||dy<0||dx>=location.width||dy>=location.height)throw new Error('Emprise du niveau de détail invalide.');
  if(data.data[dy*location.width+dx]===1)return z;
 }
 return undefined;
}
