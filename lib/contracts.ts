export type Role='admin'|'responsable'|'agent'|'producteur';
export type Forecast={id:string;crop:string;year:number;territory:string;level:string;yield:number;model:string;version:string;issuedAt:string|null;status:string;source:string;areaDefinition:string};
export type Observation={id:string;crop:string;year:number;territory:string;level:string;yield:number;source:string;areaDefinition:string};
export type Science={meta:{notebook:string;sha256:string;sourceDescription:string;limitations:string[];generatedAt:string;[key:string]:unknown};forecasts:Forecast[];observations:Observation[]};
export type RecordKind='member'|'simulation'|'collection'|'harvest'|'capacity';
export type BusinessRecord={id:string;kind:RecordKind;coopId:string;ownerId:string;data:Record<string,any>;createdAt:string;updatedAt:string;history?:any[]};
export type Session={userId:string;name:string;role:Role;coopId:string;demo:boolean};
export type Bootstrap={session:Session;records:BusinessRecord[]};
// GET /api/workspace -> Bootstrap. POST {kind,data,id?} -> {record}; all writes same-origin JSON, server validates.
// GET /api/science -> Science, immutable bundled results plus accepted versioned imports.
// POST /api/import {csv,confirm:false} -> {rows,errors,duplicates,token?}; confirm:true repeats CSV and imports valid whole batch.
// GET /api/export?kind=...&crop=...&year=...&territory=... -> filtered private CSV.
// POST /api/demo {role,coopId:'demo-a'|'demo-b'} creates signed HttpOnly demo session, only fictional workspace.
