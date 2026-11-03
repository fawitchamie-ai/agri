/** Independent implementation of the published QUEFTS equations, not Rquefts code.
 * Shehu et al. 2019, §2.4, Tables 1,3,4 (CC BY 4.0), DOI below.
 * Grain kg/ha at 15% moisture; supply and fertilizer kg elemental N/P/K per ha.
 * Parameter transfer is exploratory, never a locally validated forecast.
 */
export const QUEFTS_SOURCE='https://doi.org/10.1016/j.fcr.2019.107585';
export type NPK=[number,number,number];
export type QueftsProfile={id:string;label:string;a:NPK;d:NPK;r:NPK;recovery:NPK;soilSupply:NPK;maxDose:NPK};
export const QUEFTS_PROFILES:QueftsProfile[]=[
 {id:'NGS',label:'Savane guinéenne du Nord — Nigeria',a:[35,200,25],d:[79,527,117],r:[4,.5,4.5],recovery:[.42,.16,.54],
  soilSupply:[-20.54+.60*7.25+130.92*.47,-12.16+2.71*5.8+.71*8.43,27.10+246.22*.22],maxDose:[140,50,50]},
 {id:'SS',label:'Savane soudanienne — Nigeria',a:[32,164,24],d:[79,528,136],r:[6.1,.8,7.3],recovery:[.32,.08,.37],
  soilSupply:[11.64+155.41*.36**3,-4.11+1.40*6.2+.0005*16.54**3,228.73-35.30*6.2+275.30*.24],maxDose:[120,40,40]},
];
const indices=[0,1,2] as const;
const nonnegative=(x:number)=>Number.isFinite(x)&&x>=0;

/** Pairwise uptake, eq 2. The second threshold uses the dimensionally coherent
 * (Sj-rj)*(2*dj/ai-aj/di). It makes branches 2b/2c continuous; the HTML paper's
 * displayed parentheses around eq 2b are ambiguous. See implementation note. */
export function pairUptake(si:number,sj:number,ai:number,di:number,aj:number,dj:number,ri:number,rj:number){
 const available=Math.max(0,sj-rj),low=available*aj/di,high=available*dj/ai;
 if(si<=ri+low)return si;
 if(si>=ri+2*high-low)return Math.min(si,ri+high);
 return si-.25*(si-ri-low)**2/(high-low);
}
export function queftsYield(soil:NPK,dose:NPK,ceilingKgHa:number,p:QueftsProfile){
 if(![...soil,...dose,ceilingKgHa].every(nonnegative)||indices.some(i=>!(p.a[i]>0&&p.d[i]>p.a[i]&&p.r[i]>=0&&p.recovery[i]>=0&&p.recovery[i]<=1)))throw new Error('Invalid QUEFTS inputs');
 const supply=indices.map(i=>soil[i]+dose[i]*p.recovery[i]) as NPK;
 const uptake=indices.map(i=>Math.min(...indices.filter(j=>j!==i).map(j=>pairUptake(supply[i],supply[j],p.a[i],p.d[i],p.a[j],p.d[j],p.r[i],p.r[j])))) as NPK;
 if(ceilingKgHa===0||indices.some(i=>supply[i]<=p.r[i]))return {yieldKgHa:0,supply,uptake};
 const accumulation=indices.map(i=>p.a[i]*Math.max(0,uptake[i]-p.r[i]));
 const dilution=indices.map(i=>p.d[i]*Math.max(0,uptake[i]-p.r[i]));
 const pairs=indices.flatMap(i=>indices.filter(j=>j!==i).map(j=>{
  const k=3-i-j,cap=Math.min(dilution[j],dilution[k],ceilingKgHa),floor=accumulation[j];
  if(floor>=cap)return cap;
  const span=cap/p.a[i]-floor/p.d[i];
  const fraction=Math.max(0,Math.min(1,(uptake[i]-p.r[i]-floor/p.d[i])/span));
  return floor+(cap-floor)*(2*fraction-fraction*fraction);
 }));
 return {yieldKgHa:Math.max(0,Math.min(ceilingKgHa,...dilution,pairs.reduce((s,y)=>s+y,0)/6)),supply,uptake};
}

/** Conditional inverse: fixes the published N:P:K ratio and scales supply.
 * A control yield cannot identify three nutrient supplies. Retain BOTH profiles.
 * The anchor is never a test label or evidence of predictive accuracy. */
export function anchorSupply(targetKgHa:number,ceilingKgHa:number,p:QueftsProfile):{supply:NPK;scale:number}{
 if(!Number.isFinite(targetKgHa)||targetKgHa<=0||targetKgHa>=ceilingKgHa)throw new Error('A positive control below the ceiling is required');
 const at=(scale:number)=>p.soilSupply.map(n=>n*scale) as NPK;
 let lo=0,hi=1;
 for(let i=0;i<60&&queftsYield(at(hi),[0,0,0],ceilingKgHa,p).yieldKgHa<targetKgHa;i++)hi*=2;
 for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(queftsYield(at(mid),[0,0,0],ceilingKgHa,p).yieldKgHa<targetKgHa)lo=mid;else hi=mid;}
 return {supply:at(hi),scale:hi};
}
