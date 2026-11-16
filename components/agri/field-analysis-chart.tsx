'use client';
import {datedLineSegments} from '../../lib/seasonal/field-analysis';
import {dateLabel} from './field-analysis-map';
import {ProductIcon} from './product-ui';
const fmt=(v:number,d=1)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
export default function FieldAnalysisChart({title,unit,series,onDate,fixedDomain}:{title:string;unit:string;series:{label:string;color:string;points:{date:string;value:number|null}[]}[];onDate?:(date:string)=>void;fixedDomain?:[number,number]}){
 const all=series.flatMap(s=>s.points),dates=all.map(p=>Date.parse(p.date)),values=all.flatMap(p=>p.value===null?[]:[p.value]);
 if(!all.length||!values.length)return <div className="fa-chart-empty"><ProductIcon name="chart" size={28}/><strong>{title}</strong><span>Aucune valeur disponible sur la période choisie.</span></div>;
 const start=Math.min(...dates),end=Math.max(...dates),min=fixedDomain?.[0]??Math.min(0,...values),max=fixedDomain?.[1]??Math.max(1,...values)*1.08;
 const x=(d:string)=>start===end?316:48+(Date.parse(d)-start)/(end-start)*536,y=(v:number)=>174-(v-min)/(max-min||1)*148,ticks=[...new Set([start,Math.round((start+end)/2),end])];
 return <figure className="fa-chart"><figcaption><strong>{title}</strong><span>{unit}</span></figcaption><svg viewBox="0 0 610 215" role="img" aria-label={title}>
  {[0,.5,1].map(t=>{const v=min+(max-min)*t;return <g key={t}><line x1="48" x2="584" y1={y(v)} y2={y(v)} stroke="#e0e9f1"/><text x="39" y={y(v)+4} textAnchor="end" fontSize="10" fill="#597086">{fmt(v,unit==='indice'?1:0)}</text></g>;})}
  {ticks.map((t,i)=><text key={t} x={x(new Date(t).toISOString().slice(0,10))} y="201" textAnchor={i===0?'start':i===ticks.length-1?'end':'middle'} fontSize="10" fill="#597086">{new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short',timeZone:'UTC'})}</text>)}
  {series.map(s=><g key={s.label}>{datedLineSegments(s.points).map((part,i)=><polyline key={i} points={part.map(p=>x(p.date)+','+y(p.value)).join(' ')} fill="none" stroke={s.color} strokeWidth="2.3"/>)}{s.points.filter(p=>p.value!==null).map(p=><circle key={p.date} cx={x(p.date)} cy={y(p.value!)} r={onDate?4:2} fill={s.color} tabIndex={onDate?0:undefined} role={onDate?'button':undefined} aria-label={s.label+' '+dateLabel(p.date)+' : '+fmt(p.value!,3)} onClick={()=>onDate?.(p.date)} onKeyDown={e=>{if(onDate&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onDate(p.date);}}}><title>{dateLabel(p.date)} · {s.label} : {fmt(p.value!,3)}</title></circle>)}</g>)}
 </svg><div className="fa-chart-key">{series.map(s=><span key={s.label}><i style={{background:s.color}}/>{s.label}</span>)}</div></figure>;
}
