'use client';
import {useEffect,useMemo,useState} from 'react';
import type {SeasonalConfig,WaterPlan} from '../../lib/seasonal/types';
import {HelpParagraph} from './help-dialog';
import {ProductIcon} from './product-ui';
import './pump-sharing.css';

type RecordItem={id:string;kind:string;ownerId:string;updatedAt:string;data:Record<string,any>};
type Pump={id:string;updatedAt:string;data:Record<string,any>};
type SavedCampaign={id:string;revision:number;config:SeasonalConfig;plan:WaterPlan;demo:boolean};
const number=(value:number|undefined|null,digits=2)=>value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(value);
const timeMinutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
const asTime=(value:number)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const localDate=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
async function request<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch(path,{method:body?'POST':'GET',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 let result:any;try{result=await response.json();}catch{throw new Error('Le service ne répond pas. Réessayez sans modifier la campagne.');}
 if(!response.ok)throw new Error(result.error||'Impossible de charger les données du matériel partagé.');
 return result as T;
}

export default function PumpSharing({campaignId,config,stale,onChange,onNavigate}:{campaignId?:string;config:SeasonalConfig;stale:boolean;onChange:(config:SeasonalConfig)=>void;onNavigate?:(view:string)=>void}){
 const [records,setRecords]=useState<RecordItem[]>([]),[campaign,setCampaign]=useState<SavedCampaign|null>(null),[role,setRole]=useState(''),[userId,setUserId]=useState(''),[demo,setDemo]=useState(false);
 const [pumpId,setPumpId]=useState(''),[day,setDay]=useState(''),[start,setStart]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=async()=>{
  if(!campaignId){setRecords([]);setCampaign(null);setLoading(false);return;}
  setLoading(true);setError('');
  try{
   const [space,current]=await Promise.all([request<any>('/api/workspace'),request<{campaign:SavedCampaign}>('/api/seasonal?id='+encodeURIComponent(campaignId))]);
   setRecords(space.records??[]);setRole(space.session?.role??'');setUserId(space.session?.userId??'');setDemo(!!space.session?.demo);setCampaign(current.campaign);
  }catch(e){setError((e as Error).message);setRecords([]);setCampaign(null);}
  finally{setLoading(false);}
 };
 useEffect(()=>{void refresh();},[campaignId]);
 const pumps=useMemo(()=>records.filter(r=>r.kind==='capacity'&&Number(r.data.pumpFlowM3h)>0&&Array.isArray(r.data.pumpDays)&&r.data.pumpDays.length).map(r=>({id:r.id,updatedAt:r.updatedAt,data:r.data} as Pump)),[records]);
 const pump=pumps.find(p=>p.id===pumpId)??pumps[0];
 const days=useMemo(()=>{
  const rows=campaign?.plan?.days??[];
  return rows.filter(row=>row.date>=((campaign?.config?.asOfDate)||'')&&row.intervention?.type==='proposed'&&Number(row.intervention.durationHours)>0&&Number(row.intervention.sourceM3)>0)
   .map(row=>({date:row.date,durationHours:row.intervention!.durationHours!,sourceM3:row.intervention!.sourceM3!}));
 },[campaign]);
 useEffect(()=>{setPumpId(current=>pumps.some(item=>item.id===current)?current:pumps[0]?.id??'');},[pumps]);
 useEffect(()=>{setDay(current=>days.some(item=>item.date===current)?current:days[0]?.date??'');},[days]);
 useEffect(()=>{setStart(pump?.data.pumpStartHHmm??'');},[pump?.id,pump?.updatedAt]);
 const selectedDay=days.find(item=>item.date===day)??days[0];
 const flow=Number(pump?.data.pumpFlowM3h),sameFlow=!!pump&&config.system.sourceFlowM3h!==null&&Math.abs(config.system.sourceFlowM3h-flow)<=Math.max(.001,flow*.001);
 const datesBookings=records.filter(r=>r.kind==='pumpBooking'&&r.data.pumpId===pump?.id&&r.data.status==='reserved').sort((a,b)=>String(a.data.date+a.data.startHHmm).localeCompare(String(b.data.date+b.data.startHHmm)));
 const weekday=selectedDay?new Date(selectedDay.date+'T00:00:00Z').getUTCDay():-1,available=!!pump&&(pump.data.pumpDays as number[]).includes(weekday);
 const durationMinutes=selectedDay?Math.ceil(selectedDay.durationHours*60):0,startNumber=/^\d\d:\d\d$/.test(start)?timeMinutes(start):-1,endNumber=startNumber<0? -1:startNumber+durationMinutes;
 const fits=!!pump&&available&&startNumber>=timeMinutes(pump.data.pumpStartHHmm)&&endNumber<=timeMinutes(pump.data.pumpEndHHmm)&&endNumber<=1440;
 const canManage=['admin','responsable','agent'].includes(role);
 async function reserve(){if(!pump||!selectedDay||!campaign||!fits||stale||!sameFlow||demo)return;setBusy(true);setError('');setNotice('');try{
   await request('/api/workspace',{kind:'pumpBooking',data:{pumpId:pump.id,campaignId,date:selectedDay.date,startHHmm:start,status:'reserved'}});
   setNotice('Créneau réservé à partir du bilan d’eau enregistré.');await refresh();
  }catch(e){setError((e as Error).message);await refresh();}finally{setBusy(false);}}
 async function cancel(booking:RecordItem){setBusy(true);setError('');setNotice('');try{
   await request('/api/workspace',{kind:'pumpBooking',id:booking.id,updatedAt:booking.updatedAt,data:{pumpId:booking.data.pumpId,campaignId:booking.data.campaignId,date:booking.data.date,startHHmm:booking.data.startHHmm,status:'cancelled'}});
   setNotice('Réservation annulée. Le créneau est de nouveau disponible.');await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function applyPumpSettings(){if(!pump)return;const hours=(timeMinutes(pump.data.pumpEndHHmm)-timeMinutes(pump.data.pumpStartHHmm))/60;onChange({...config,system:{...config.system,name:String(pump.data.point||'Pompe partagée'),source:`Débit et horaires déclarés par la coopérative · enregistrement ${pump.id}`,sourceFlowM3h:flow,hoursPerDay:hours}});setNotice('Paramètres du matériel repris dans la campagne. Enregistrez-la et attendez son recalcul avant de réserver.');}
 return <section className="pump-share-panel" aria-labelledby="pump-sharing-title">
  <div className="pump-share-heading"><div><span className="product-eyebrow">MATÉRIEL DE LA COOPÉRATIVE</span><h3 id="pump-sharing-title">Partager une pompe</h3><HelpParagraph>Les créneaux utilisent le débit déclaré et les volumes calculés dans la dernière révision enregistrée de la campagne.</HelpParagraph></div><ProductIcon name="water" size={20}/></div>
  {error&&<div className="notice warning" role="alert">{error}</div>}{notice&&<div className="notice info" role="status">{notice}</div>}
  {loading?<p role="status">Chargement des pompes et réservations…</p>:demo?<div className="pump-share-empty"><strong>Réservations désactivées en démonstration</strong><p>Connectez-vous à un espace coopératif réel pour voir le matériel et les créneaux partagés.</p></div>:!campaignId?<div className="pump-share-empty"><strong>Campagne requise</strong><p>Ouvrez une campagne enregistrée avant de réserver une pompe.</p></div>:!pumps.length?<div className="pump-share-empty"><strong>Aucune pompe déclarée</strong><p>Le responsable de l’espace doit enregistrer le débit et les horaires réels dans « Ma coopérative → Moyens ».</p><button className="btn secondary" onClick={()=>onNavigate?.('gestion')}>Gérer le matériel <ProductIcon name="arrow" size={15}/></button></div>:<>
   <div className="form-grid"><label className="field"><span>Pompe</span><select value={pump?.id??''} onChange={e=>setPumpId(e.target.value)}>{pumps.map(item=><option key={item.id} value={item.id}>{item.data.point} · {number(Number(item.data.pumpFlowM3h))} m³/h</option>)}</select></label>{days.length>0&&<label className="field"><span>Apport proposé par le bilan</span><select value={selectedDay?.date??''} onChange={e=>setDay(e.target.value)}>{days.map(item=><option key={item.date} value={item.date}>{localDate(item.date)} · {number(item.sourceM3)} m³ · {number(item.durationHours)} h</option>)}</select></label>}</div>
   {!days.length?<div className="pump-share-empty"><strong>Aucun créneau calculé à réserver</strong><p>Le moteur doit fournir un arrosage futur avec volume et durée à partir de la campagne enregistrée. Les jours manquants ne sont pas remplacés par des valeurs d’exemple.</p></div>:!available?<p className="notice warning">Cette pompe n’est pas déclarée disponible le {selectedDay?localDate(selectedDay.date):'jour choisi'}.</p>:!sameFlow?<div className="pump-share-empty"><strong>Le débit de la campagne diffère de celui de la pompe</strong><p>La simulation doit être recalculée avec le débit réel de {number(flow)} m³/h avant de réserver.</p><button className="btn secondary" disabled={stale||busy} onClick={applyPumpSettings}>Utiliser le débit et les horaires déclarés</button></div>:<div className="pump-share-booking"><label className="field"><span>Début du créneau</span><input type="time" step="900" min={pump.data.pumpStartHHmm} max={pump.data.pumpEndHHmm} value={start||pump.data.pumpStartHHmm} onChange={e=>setStart(e.target.value)}/></label><p>Durée calculée : <strong>{number(selectedDay!.durationHours)} h</strong> · fin prévue à <strong>{startNumber<0?pump.data.pumpEndHHmm:asTime(endNumber)}</strong> · volume source : <strong>{number(selectedDay!.sourceM3)} m³</strong>.</p>{stale&&<p className="notice warning">Enregistrez la campagne et attendez son nouveau calcul avant de réserver.</p>}{!fits&&!stale&&<p className="notice warning">La durée du bilan ne tient pas dans les horaires déclarés pour ce jour.</p>}<button className="btn primary" disabled={busy||stale||!fits||!sameFlow} onClick={()=>void reserve()}>{busy?'Enregistrement…':'Réserver ce créneau'}</button></div>}
   <div className="pump-share-bookings"><h4>Réservations de cette pompe</h4>{datesBookings.length?<ul>{datesBookings.map(item=><li key={item.id}><span><strong>{localDate(item.data.date)} · {item.data.startHHmm}–{item.data.endHHmm}</strong><small>{item.data.campaignName||'Campagne'} · {number(Number(item.data.volumeM3))} m³</small></span>{(item.ownerId===userId||canManage)&&<button type="button" className="btn secondary small" disabled={busy} onClick={()=>void cancel(item)}>Annuler</button>}</li>)}</ul>:<p>Aucun créneau réservé pour cette pompe.</p>}</div>
  </>}
 </section>;
}
