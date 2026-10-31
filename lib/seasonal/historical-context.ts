import raw from '../../data/seasonal/faostat-context.json' with {type:'json'};
import type {Country} from './types.ts';
type Datum={value:number|null;flag:string;note:string;rawValue:number|null;rawUnit:string};
type Row=[Country,number,number,Datum|null,Datum|null,Datum|null];
type Snapshot={version:string;source:string;licence:string;acquiredAt:string;archiveSha256:string;period:{from:number;to:number};items:Record<string,{name:string;cpc:string}>;flags:Record<string,string>;limits:string[];warnings:[Country,number,number,string][];rows:Row[]};
const data=raw as unknown as Snapshot;
// Mapping is for context only. Aggregate products never establish compatibility with field Ym.
const products:Record<string,{code:number;scope:string}>={
 maize:{code:56,scope:'Maïs grain national ; pas maïs vert.'},sorghum:{code:83,scope:'Sorgho national, variétés et conduites regroupées.'},millet:{code:79,scope:'Millet national, espèces regroupées ; pas une série propre au mil perlé.'},
 'rice-upland':{code:27,scope:'Riz national tous systèmes ; ne distingue pas le pluvial du submergé.'},'rice-flooded':{code:27,scope:'Riz national tous systèmes ; ne distingue pas le pluvial du submergé.'},
 cowpea:{code:195,scope:'Niébé sec national.'},soybean:{code:236,scope:'Soja national.'},groundnut:{code:242,scope:'Arachide non décortiquée nationale ; ne pas assimiler à la masse de graines décortiquées.'},bambara:{code:203,scope:'Voandzou sec national.'},cassava:{code:125,scope:'Manioc frais national, durées de culture regroupées.'},'sweet-potato':{code:122,scope:'Patates douces nationales.'},yam:{code:137,scope:'Ignames nationales, espèces regroupées ; pas spécifiquement igname blanche.'},
 onion:{code:403,scope:'Oignons et échalotes secs nationaux, hors déshydratés.'},tomato:{code:388,scope:'Tomates nationales.'},okra:{code:430,scope:'Gombo national.'},'hot-pepper':{code:401,scope:'Piments et poivrons verts nationaux regroupés ; ni piment sec ni variété particulière.'},'bell-pepper':{code:401,scope:'Piments et poivrons verts nationaux regroupés ; ne distingue pas le poivron doux.'},cabbage:{code:358,scope:'Choux nationaux.'},cucumber:{code:397,scope:'Concombres et cornichons nationaux regroupés.'},watermelon:{code:567,scope:'Pastèques nationales.'},eggplant:{code:399,scope:'Aubergines nationales.'},sesame:{code:289,scope:'Graines de sésame nationales.'},fonio:{code:94,scope:'Fonio national, espèces regroupées.'}
};
export function historicalContext(country:Country,cropId:string,asOfDate:string){
 const product=products[cropId],base={version:data.version,source:data.source,licence:data.licence,acquiredAt:data.acquiredAt,archiveSha256:data.archiveSha256,period:data.period,scope:'national' as const,denominator:'harvested' as const,independentYm:false,product:product?{...product,...data.items[String(product.code)]}:null,flags:data.flags,limits:data.limits};
 if(data.acquiredAt.slice(0,10)>asOfDate)return {...base,status:'not_available_as_of',rows:[],missing:'Cette archive a été acquise après la date du conseil ; aucune donnée rétrospective ajoutée à cette prédiction.'};
 if(!product)return {...base,status:'unavailable',rows:[],missing:'Correspondance du produit statistique national non qualifiée.'};
 const rows=data.rows.filter(r=>r[0]===country&&r[1]===product.code).map(r=>({year:r[2],areaHa:r[3],productionT:r[4],yieldKgHaHarvested:r[5],warnings:data.warnings.filter(w=>w[0]===r[0]&&w[1]===r[1]&&w[2]===r[2]).map(w=>w[3])}));
 return {...base,status:rows.length?'context_only':'unavailable',rows,missing:rows.length?null:'Aucune ligne acquise pour ce pays/produit ; absence de donnée, pas production nulle.'};
}
