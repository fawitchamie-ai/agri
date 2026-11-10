import {buildInfo} from '../../../lib/build-info.ts';
export function GET(){return Response.json(buildInfo(),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
