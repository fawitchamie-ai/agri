import {ENGINE_VERSION} from './seasonal/types.ts';
import {GROWTH_ENGINE_VERSION,GROWTH_VERSION} from './seasonal/growth.ts';
import {CATALOG_VERSION} from './seasonal/catalog.ts';
import {NASA_VERSION} from './seasonal/nasa.ts';
import {KY_VERSION} from './seasonal/water-response.ts';
import {WATER_STAGES_VERSION} from './seasonal/water-stages.ts';
declare const __AGRI_BUILD__: {commit:string|null;builtAt:string|null};
/** Public, non-personal metadata. No environment or provider credentials exposed. */
export function buildInfo(){
 const build=typeof __AGRI_BUILD__==='undefined'?{commit:null,builtAt:null}:__AGRI_BUILD__;
 return {...build,engines:{water:ENGINE_VERSION,growth:GROWTH_ENGINE_VERSION,waterResponse:KY_VERSION,grainStages:WATER_STAGES_VERSION,nasa:NASA_VERSION},parameters:{catalog:CATALOG_VERSION,growthSchema:GROWTH_VERSION,growthDefaults:'illustrative-1'},localCalibration:false};
}
