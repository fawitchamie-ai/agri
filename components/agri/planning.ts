/** Capacities are user inputs. A transport limit applies to one point/date/time slot. */
export type PlannedVolume={point:string;date:string;slotHHmm?:string;committed:number;status:string};
export type PointCapacity={point:string;storage:number;transport:number};
export function planningAlerts(plans:PlannedVolume[],capacities:PointCapacity[]):string[]{
 const alerts:string[]=[];const active=plans.filter(p=>p.status!=='annule');
 for(const point of [...new Set(active.map(p=>p.point))]){
  const cap=capacities.filter(c=>c.point===point);if(!cap.length)continue;
  const storage=cap.reduce((s,c)=>s+Number(c.storage||0),0),transport=cap.reduce((s,c)=>s+Number(c.transport||0),0);
  const pointPlans=active.filter(p=>p.point===point),all=pointPlans.reduce((s,p)=>s+Number(p.committed||0),0);
  if(all>storage)alerts.push(`${point} : ${all.toLocaleString('fr-FR')} t engagées pour ${storage.toLocaleString('fr-FR')} t de stockage. Contrôle prudent sur la campagne, sans supposer de rotation du stock.`);
  const slots=new Map<string,number>();for(const p of pointPlans){const key=p.date.slice(0,10)+' à '+(p.slotHHmm||'08:00');slots.set(key,(slots.get(key)||0)+Number(p.committed||0));}
  for(const [slot,volume] of slots)if(volume>transport)alerts.push(`${point}, ${slot} : ${volume.toLocaleString('fr-FR')} t engagées pour ${transport.toLocaleString('fr-FR')} t de transport sur ce créneau. Répartissez les passages ou adaptez les moyens.`);
 }
 return alerts;
}
