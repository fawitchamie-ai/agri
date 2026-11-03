// Local CPU diagnostic; not a measurement of Cloudflare's production CPU meter.
// Run: node --experimental-transform-types scripts/profile-seasonal-cpu.mjs
import {exampleCampaign} from '../lib/seasonal/example.ts';
import {planSeason} from '../lib/seasonal/yield.ts';
import {assessLandGeometry,missingLandLayer} from '../lib/seasonal/land.ts';
const shape={type:'Polygon',coordinates:[[[1.2,9.5],[1.204,9.5],[1.204,9.5042],[1.2,9.5042],[1.2,9.5]]]};
const layer={...missingLandLayer('worldcover','',new Date().toISOString()),status:'available',cells:[]};
for(let x=0;x<40;x++)for(let y=0;y<42;y++){
 const a=1.2+x*.0001,b=9.5+y*.0001;
 layer.cells.push({id:`${x}:${y}`,value:(x+y)%4?40:50,geometry:{type:'Polygon',coordinates:[[[a,b],[a+.0001,b],[a+.0001,b+.0001],[a,b+.0001],[a,b]]]}});
}
const campaign=exampleCampaign();
for(const [name,run] of [['example-season',()=>planSeason(campaign)],['fragmented-20ha-1680-cells',()=>assessLandGeometry(shape,[layer])]]){
 for(let attempt=0;attempt<3;attempt++){
  const started=performance.now(),cpu=process.cpuUsage();run();const used=process.cpuUsage(cpu);
  console.log(JSON.stringify({name,attempt:attempt+1,localCpuMs:(used.user+used.system)/1000,localWallMs:performance.now()-started}));
 }
}
