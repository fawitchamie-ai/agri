import {buildInfo} from '../../../lib/build-info.ts';
import {numericalProbe} from '../../../lib/seasonal/numerical-probe.ts';
export function GET(){return Response.json({...buildInfo(),numericalProbe:numericalProbe()},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
