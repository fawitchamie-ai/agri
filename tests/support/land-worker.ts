// Test entry point only: never deployed with the application.
import {loadLandAssessment} from '../../lib/seasonal/land-provider';
import {polygonFromPoints} from '../../lib/seasonal/parcel';

export default {
  async fetch(request:Request){
    if(new URL(request.url).pathname==='/unsupported'){
      try{new Request('https://example.com',{redirect:'error'});return Response.json({rejected:false});}
      catch{return Response.json({rejected:true});}
    }
    const params=new URL(request.url).searchParams,lon=Number(params.get('lon')??2.45),lat=Number(params.get('lat')??6.4333),d=.0002;
    const shape=polygonFromPoints([[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d]]);
    const a=await loadLandAssessment(shape,fetch,new Date().toISOString(),true);
    return Response.json({status:a.status,areaM2:a.areaM2,fractions:Object.fromEntries(Object.entries(a.fractions).map(([k,v])=>[k,v.fraction])),sources:a.sources});
  }
};
