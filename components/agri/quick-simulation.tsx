'use client';
import { HelpParagraph } from './help-dialog';
import {useEffect,useRef,useState} from 'react';
import {seasonalRequest,pauseLandAnalysis,resumeLandAnalysis,type LandProgress} from '../../lib/seasonal/request';
import {CROPS} from '../../lib/seasonal/catalog';
import {automaticCampaign,mergeEnvironment} from '../../lib/seasonal/automatic';
import type {Environment} from '../../lib/seasonal/environment';
import {COUNTRIES,type SeasonalConfig,type WaterPlan,type WaterEvent} from '../../lib/seasonal/types';
import './quick-simulation.css';
import WaterChart from './water-chart';
import ParcelLayers from './parcel-layers';
import {ProductIcon,ParcelFootprint,Disclosure} from './product-ui';
import EditableValue from './editable-value';
import SowingSummary from './sowing-summary';
import InterventionComparison from './intervention-comparison';
import ManagementPlanner from './management-planner';
import {waterOverview} from '../../lib/seasonal/overview';
import DataCompletion from './data-completion';
import AgronomicPanel from './agronomic-panel';
import YieldSummary from './yield-summary';
import ScenarioGuide from './scenario-guide';
import FertilizerPanel from './fertilizer-panel';
import FieldTrials from './field-trials';
import InputStatus from './input-status';
import {FieldOverview,FieldNotebook} from './field-workspace';
import type {FieldAction} from '../../lib/seasonal/field-intelligence';
import {waterIndicator} from '../../lib/seasonal/water-indicator';
import {declareScenario} from '../../lib/seasonal/provenance';
import {geometryIdentity,environmentContext} from '../../lib/seasonal/provenance';
const fmt=(v:number|null|undefined,d=0)=>v==null?'â€”':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(v);
const date=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
type Props={landProgress?:LandProgress|null;config:SeasonalConfig;plan:WaterPlan|null;stale:boolean;onChange:(c:SeasonalConfig)=>void;onMap:()=>void;onAdvanced:(tab:string)=>void;onSave:()=>void;canSave:boolean;events:WaterEvent[];calculationError?:string;onRetry?:()=>void;initialSection?:string;paused?:boolean};
export default function QuickSimulation({landProgress,config,plan,stale,onChange,onMap,onAdvanced,onSave,canSave,events,calculationError,onRetry,initialSection,paused=false}:Props){
 const [environment,setEnvironment]=useState<Environment|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[sectorJob,setSectorJob]=useState<any>(null);
 const [section,setSection]=useState(initialSection??'overview');
 const focusYieldAfterSection=useRef(false);
 useEffect(()=>{setSection(initialSection??'overview');focusYieldAfterSection.current=initialSection==='yield';},[initialSection]);
 useEffect(()=>{if(section==='yield'&&focusYieldAfterSection.current){focusYieldAfterSection.current=false;document.getElementById('field-tab-yield')?.focus();}},[section]);
 const [fertilizerView,setFertilizerView]=useState('products');
 const [advancedView,setAdvancedView]=useState('settings');
 const sections=[['overview','SynthÃ¨se','grid'],['yield','Rendement & production','chart'],['water','Eau','water'],['fertilizer','Engrais','leaf'],['images','Images','satellite'],['settings','DonnÃ©es & rÃ©glages','settings']];
 function fieldAction(target:FieldAction['target']){
  if(target==='map'){onMap();return;}if(target==='soil'){onAdvanced('sol');return;}
  if(target==='notes'){setAdvancedView('notes');setSection('settings');return;}
  setSection(target==='water'?'water':target==='fertilizer'?'fertilizer':'overview');
  if(target==='yield')setSection('yield');
 }
 const progress=landProgress??sectorJob;
 const latest=useRef(config);latest.current=config;
 const duration=config.stages.reduce((s,x)=>s+x.days,0);
 const key=config.parcelGeometry?JSON.stringify([geometryIdentity(config.parcelGeometry),config.country,config.sowingDate,duration]):'';
 const parcelKey=config.parcelGeometry?JSON.stringify(config.parcelGeometry):'';
 const previousParcel=useRef(parcelKey),refreshKey=useRef<string|null>(null);
 function refreshData(){refreshKey.current=key;setRetry(x=>x+1);}
 useEffect(()=>{if(previousParcel.current!==parcelKey){previousParcel.current=parcelKey;setEnvironment(null);setSectorJob(null);setError('');}},[parcelKey]);
 useEffect(()=>{
  if(paused||!key||!duration){setLoading(false);return;}
  const refresh=refreshKey.current===key;refreshKey.current=null;
  const controller=new AbortController();let alive=true;setLoading(true);setError('');
  seasonalRequest<Environment>({action:'environment',latitude:config.latitude,longitude:config.longitude,country:config.country,start:config.sowingDate,days:duration,geometry:config.parcelGeometry,refresh},controller.signal,90_000,fetch,{onLandProgress:p=>{if(alive)setSectorJob(p);}})
   .then(d=>{if(!alive||environmentContext(latest.current)!==environmentContext(config))return;setEnvironment(d);onChange(mergeEnvironment(latest.current,d));})
   .catch(e=>{if(alive)setError(e.message==='Failed to fetch'?'Connexion indisponible. RÃ©essayez ou ajustez les hypothÃ¨ses.':e.message);})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;controller.abort();};
 },[key,retry,paused]); // edits to a value never trigger a new network request
 const phAnalysis=config.soilAnalyses?.find(a=>a.measurements.some(m=>m.parameter==='pH'));
 const ph=phAnalysis?.measurements.find(m=>m.parameter==='pH')?.value??null;
 const indicator=waterIndicator(config,plan,stale,loading);
 const usable=indicator.kind==='ready'&&plan;
 const unavailableLabel=loading||stale?'Calcul en prÃ©paration':plan?.status==='blocked'?'Calcul suspendu : voir les informations manquantes':'Simulation Ã  complÃ©ter';
 const overview=waterOverview(config,usable?plan:null);
 const reservePercent=config.soil.layers.some(l=>l.initialTheta===null)?null:Math.round(100*config.soil.layers.reduce((n,l)=>n+l.thicknessM*(l.initialTheta!-l.thetaWP),0)/Math.max(.00001,config.soil.layers.reduce((n,l)=>n+l.thicknessM*(l.thetaFC-l.thetaWP),0)));
 const fieldFlooded=config.waterCondition==='waterlogged'||config.waterCondition==='submerged';
 const mixedLand=config.landSelection!=='potentialLand'&&(config.landAssessment?.candidateAreaM2??0)>0&&(config.landAssessment?.fractions.potentialLand.fraction??1)<1-1e-7;
 function selectCrop(id:string){try{onChange(automaticCampaign({...config,weather:[]},id));setError('');}catch(e){setError((e as Error).message);}}
 function setPh(value:string){const n=value===''?null:Number(value);const analyses=(config.soilAnalyses??[]).map(a=>({...a,measurements:a.measurements.filter(m=>m.parameter!=='pH')})).filter(a=>a.measurements.length);onChange({...config,soilAnalyses:[...analyses,...(n!==null?[{source:'Valeur saisie par lâ€™utilisateur',date:config.asOfDate,availableOn:config.asOfDate,topCm:5,bottomCm:15,status:'declared' as const,measurements:[{parameter:'pH' as const,value:n,unit:'pH',method:'water'}]}]:[])]});}
 function climateChange(key:'rainMm'|'et0Mm',factor:number){onChange({...config,weather:config.weather.map(w=>({...w,[key]:w[key]===null?null:w[key]!*factor,status:'scenario',source:'Ajustement utilisateur â€” '+w.source.replace(/^Ajustement utilisateur â€” /,'')}))});}
 function runSectors(){if(progress?.id)resumeLandAnalysis(progress.id);setError('');setRetry(x=>x+1);onRetry?.();}
 return <div className="quick-sim simulation-workbench" aria-busy={!calculationError&&!error&&(stale||loading)}>
  {!config.parcelGeometry?<section className="simulation-start" aria-labelledby="start-campaign-title">
   <div className="simulation-start-copy"><span className="start-step-label">Ã‰TAPE 1 SUR 3 Â· LA PARCELLE</span><h2 id="start-campaign-title">Commencez par votre champ.</h2><p>RepÃ©rez le terrain, choisissez la culture et la date de semis. Lâ€™application ouvrira ensuite les calculs rÃ©ellement disponibles pour votre campagne.</p>
    <label className="field start-country"><span>Dans quel pays se trouve votre champ ?</span><select aria-label="Pays de la parcelle" value={config.country} onChange={e=>onChange({...config,country:e.target.value as SeasonalConfig['country'],territory:''})}>{Object.entries(COUNTRIES).map(([id,country])=><option key={id} value={id}>{country.name}</option>)}</select></label>
    <button className="btn primary start-map-button" onClick={onMap}>Situer mon champ <ProductIcon name="arrow" size={18}/></button><small className="start-action-help">AprÃ¨s la culture et le semis, vous verrez le bilan dâ€™eau et, si la mÃ©thode le permet, le rendement.</small><button className="start-import" onClick={()=>onAdvanced('fichiers')}>Jâ€™ai dÃ©jÃ  un fichier de campagne <ProductIcon name="arrow" size={16}/></button>
   </div>
   <div className="simulation-start-visual" aria-hidden="true"><div className="start-visual-head"><span>VOTRE ESPACE AGRICOLE</span><b>01 / 03</b></div><ParcelFootpvÛ¾í¢G§²ÚîÆ­yÜÛÛYJOO–ÉÛYX\Ý\™Y	Ë	ÙXÛ\™Y	×Kš[˜ÛY\ÊKœÝ]\ÊJ_KÏÏŸBˆÜÙXÝ[ÛOOIÞZY[	É‰ZY[Ý[[X\žHÛÛ™šYÏ^ØÛÛ™šYßH[^ØØ[Ý[][Û‘\œ›ÜŸ\œ›ÜÛ[œ[ŸHÝ[O^ÜÝ[_ØY[™ßH˜Z[Y^ÈHJØ[Ý[][Û‘\œ›ÜŸ\œ›ÜŠ_H˜Z[\™SY\ÜØYÙO^ØØ[Ý[][Û‘\œ›ÜŸ\œ›ÜŸHÛ”™]žO^ØØ[Ý[][Û‘\œ›ÜÛÛ”™]žNœ™Yœ™\Ú]_HÛÚ[™ÙO^ÛÛÚ[™Ù_HÛ‘™\[^™\^Ê
OOœÙ]ÙXÝ[ÛŠ	Ù™\[^™\‰Ê_HÛ•Ø]\^Ê
OOœÙ]ÙXÝ[ÛŠ	ÝØ]\‰Ê_HÛÛÛ™šYÝ\™O^Ê
OOžÜÙ]Y˜[˜ÙYšY]Ê	ÜÙ][™ÜÉÊNÜÙ]ÙXÝ[ÛŠ	ÜÙ][™ÜÉÊNß_KÏŸBˆÜÙXÝ[ÛOOIÝØ]\‰É‰]ˆÛ\ÜÓ˜[YOH›[Ù[KZ[›ÈÜ[ˆÛ\ÜÓ˜[YOHœ›ÙXÝY^YXœ›ÝÈ”°âTT‘TˆTÈTÔ•È8 &QPUOÜÜ[”Ù[Y\ˆ]\œ›ÜÙ\Ú[\˜YÜ˜\”™]›Ý]™^ˆ\È]X[]0ê\È]\È]\È›ÜÜðêY\Ëˆ\°êÈ[ˆÚ[™Ù[Y[8 &Z\œšYØ][Û‹Ý]œ™^ˆ0ªÈ°ê\Ý[]È0®ÈÝ\ˆÛÛ\\™\ˆ8 &YY™™]Yš\]YH]H™[™[Y[Ú[][0êKÒ[\˜YÜ˜\]ÛˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\žHˆÛÛXÚÏ^Ê
OOœÙ]ÙXÝ[ÛŠ	ÞZY[	Ê_O•›Ú\ˆ\È°ê\Ý[]È8 &YX]H8¡¤Ø]ÛÙ]]ˆÛ\ÜÓ˜[YOHÛÜšØ™[˜Ú]Ø]\‹YÜšYÙXÝ[ÛˆÛ\ÜÓ˜[YOHœ\ËXØ\™Ø]\‹[™^Ü[ˆÛ\ÜÓ˜[YOHœ›ÙXÝY^YXœ›ÝÈ”“ÐÒRSˆT”“ÔÐQÑH“ÔÔðâOÜÜ[Ý›Û™ÏžÝ\ØX›I‰œ[‹›™^Ú[™ÝÜÖÌOÏžÙ›]
[‹›™^Ú[™ÝÜÖÌK›Û[YK™šY[LÊ_HÛX[›p¬È]HÚ[\ÜÛX[ÏŽ\ØX›OÉÐ]XÝ[ˆ›ÜÜðêIÎ‰ðàØ[Ý[\‰ßOÜÝ›Û™Ï[\˜YÜ˜\žÝ\ØX›I‰œ[‹›™^Ú[™ÝÜÖÌOØ0à\\ˆH	Ù]J[‹›™^Ú[™ÝÜÖÌK™œ›ÛJ_X‰ÔÙ[Ûˆ\ÈÛ›°êY\ÈH›Ý™HØ[\YÛ™IßOÒ[\˜YÜ˜\]°à°ê]›Ú\ˆÝ\ˆHÞXÛOÙžÝ\ØX›OÙ›]
Ý™\šY]Ëœ›ÜÜÙY™šY[LÊN‰ø %	ßHp¬ÏÙÙ]]“›ÛXœ™H8 &X\ÜÈ›ÜÜðê\ÏÙžÝ\ØX›OÛÝ™\šY]Ëœ›ÜÜÙY˜ÛÝ[‰ø %	ßOÙÙ]Ù]ÛˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\žHˆÛÛXÚÏ^Ê
OO›ÛY˜[˜ÙY
	Ü[‰Ê_O“Ý]œš\ˆHØ[[™šY\ˆ›ÙXÝXÛÛˆ˜[YOH˜\œ›ÝÈˆÚ^™O^ÌMŸKÏØ]ÛÛX[°à°ê\\\ˆÝ\ˆHÞXÛKˆ°ê\šYšY^ˆHZYH°êY[H]8 &XXØðêÈ0è8 &YX]H]˜[8 &X\œ›ÜÙ\‹ÜÛX[ÜÙXÝ[ÛÛÝÚ[™ÔÝ[[X\žHÛÛ™šYÏ^ØÛÛ™šYßH[^Ü[ŸHÝ[O^ÜÝ[_HÛÚ[™ÙO^ÛÛÚ[™Ù_H\™XSØÚÙY^Ù]™[ËœÛÛYJOO–ÉÛYX\Ý\™Y	Ë	ÙXÛ\™Y	×Kš[˜ÛY\ÊKœÝ]\ÊJ_KÏÙ]žÝ\ØX›I‰Ø]\Ú\ÛÛ™šYÏ^ØÛÛ™šYßH[^Ü[ŸKÏŸO\ØÛÜÝ\™H]OH“[ÙYšY\ˆY\È\ÜÈ°ê]\Èˆ\ØÜš\[ÛH’\œšYØ][Û‹Ù[Y[˜Ù\È]]]™\È[\™[[ÛœÈX[˜YÙ[Y[[›™\ˆÛÛ™šYÏ^ØÛÛ™šYßH[^Ü[ŸHÝ[O^ÜÝ[_HÛÚ[™ÙO^ÛÛÚ[™Ù_HÛXÝX[^Ê
OO›ÛY˜[˜ÙY
	ÜÝZ]šIÊ_KÏÑ\ØÛÜÝ\™O\ØÛÜÝ\™H]OHÛÛ\\™\ˆ\È[\™[[ÛœÈ[\™[[ÛÛÛ\\š\ÛÛˆÛÛ™šYÏ^ØÛÛ™šYßH]™[Ï^Ù]™[ßKÏÑ\ØÛÜÝ\™OÏŸBˆÜÙXÝ[ÛOOIÙ™\[^™\‰É‰]ˆÛ\ÜÓ˜[YOH›[Ù[KZ[›ÈÜ[ˆÛ\ÜÓ˜[YOHœ›ÙXÝY^YXœ›ÝÈÓÓTÔÑTˆUÓÓTT‘TÜÜ[“Y\È[™Ü˜Z\ÏÚ[\˜YÜ˜\”°ê\\™^ˆ›ÜÈ\ÜËZ\È^Ü™^ˆ]\ˆY™™]ÜœÜ]YHH[Ù0êHH\›Y]Ò[\˜YÜ˜\Ù]]ˆÛ\ÜÓ˜[YOH›[Ù[K\ÝÚ]Úˆ\šXK[X™[H‘›Û˜Ý[ÛœÈ[™Ü˜Z\ÈžÖÖÉÜ›ÙXÝÉË	ÌKˆY\È\ÜÉ×KÉÙY™™XÝ	Ë	Ì‹ˆY™™]Ý\ˆH™[™[Y[	×KÉØÛÛ\\™IË	ÐÛÛ\\™\ˆ\È[\™[[ÛœÉ×WK›X\

ÚYX™[JOO]ÛˆÙ^O^ÚYH\šXK\™\ÜÙY^Ù™\[^™\•šY]ÏOOZYHÛÛXÚÏ^Ê
OOœÙ]™\[^™\•šY]ÊY
_OžÛX™[OØ]ÛŠ_OÙ]žÙ™\[^™\•šY]ÏOOIÜ›ÙXÝÉÉ‰X[˜YÙ[Y[[›™\ˆ[š]X[Ú[™H™™\[^™\ˆˆÛÛ™šYÏ^ØÛÛ™šYßH[^Ü[ŸHÝ[O^ÜÝ[_HÛÚ[™ÙO^ÛÛÚ[™Ù_HÛXÝX[^Ê
OO›ÛY˜[˜ÙY
	ÜÝZ]šIÊ_KÏ]ÛˆÛ\ÜÓ˜[YOH˜ˆš[X\žH™\[^™\‹[™^ˆÛÛXÚÏ^Ê
OOœÙ]™\[^™\•šY]Ê	ÙY™™XÝ	Ê_O•›Ú\ˆ8 &YY™™]Ý\ˆH™[™[Y[›ÙXÝXÛÛˆ˜[YOH˜\œ›ÝÈˆÚ^™O^ÌNKÏØ]ÛÏŸ^Ù™\[^™\•šY]ÏOOIÙY™™XÝ	É‰™\[^™\”[™[ÛÛ™šYÏ^ØÛÛ™šYßH[^Ü[ŸHÝ[O^ÜÝ[_HÛÚ[™ÙO^ÛÛÚ[™Ù_HÛY˜[˜ÙY^ÛÛY˜[˜ÙYKÏŸHÙ™\[^™\•šY]ÏOOIØÛÛ\\™IÉ‰[\™[[ÛÛÛ\\š\ÛÛˆÛÛ™šYÏ^ØÛÛ™šYßH]™[Ï^Ù]™[ßHØÛÜOH™™\[^™\ˆˆÛ“Ü[‘™\[^™\^Ê
OOœÙ]™\[^™\•šY]Ê	ÙY™™XÝ	Ê_KÏŸOÏŸBˆÜÙXÝ[ÛOOIÚ[XYÙ\ÉÉ‰]ˆÛ\ÜÓ˜[YOH›[Ù[KZ[›ÈÜ[ˆÛ\ÜÓ˜[YOHœ›ÙXÝY^YXœ›ÝÈ“Ð”ÑT•‘TˆHTÑSOÜÜ[’[XYÙ\ÈHÚ[\Ú[\˜YÜ˜\‘^Ü™^ˆ\È[XYÙ\È]\È[™XØ]]\œÈ\ÜÛšX›\ÈÝ\ˆ›Ý™H\˜Ù[Kˆ°ê\šYšY^ˆ]\ˆ]H]]\œÈ[Z]\È]˜[H\È[\œ°ê]\ˆˆ[È™H™[\XÙ[\È[™HØœÙ\˜][Ûˆ]HÚ[\Ò[\˜YÜ˜\Ù]\˜Ù[^Y\œÈÛÛ™šYÏ^ØÛÛ™šYßH\ÜÙ\ÜÛY[^Ü[Ë›[™ÏØÛÛ™šYË›[™\ÜÙ\ÜÛY[HÛ“X\^ÛÛ“X\KÏÏŸBˆÜÙXÝ[ÛOOIÜÙ][™ÜÉÉ‰]ˆÛ\ÜÓ˜[YOH™^\\ÝX›˜]ˆˆ\šXK[X™[H“Ý][ÈH°êYÛYÙH]˜[˜ðê\ÈžÖÖÉÜÙ][™ÜÉË	Ô\˜[pê™\È]ÛÝ\˜Ù\É×KÉÚ[XYÙ\ÉË	Ò[XYÙ\ÈHÚ[\	×KÉÛ›Ý\ÉË	ÐØ\›™]]\ÜØZ\É×WK›X\

ÚYX™[JOO]Ûˆ\OH˜]ÛˆˆÙ^O^ÚYH\šXK\™\ÜÙY^ØY˜[˜ÙYšY]ÏOOZYHÛÛXÚÏ^Ê
OOœÙ]Y˜[˜ÙYšY]ÊY
_OžÛX™[OØ]ÛŠ_OÙ]žØY˜[˜ÙYšY]ÏOOIÚ[XYÙ\ÉÉ‰]ˆÛ\ÜÓ˜[YOH›[Ù[KZ[›ÈÜ[ˆÛ\ÜÓ˜[YOHœ›ÙXÝY^YXœ›ÝÈ“Ð”ÑT•‘TˆHTÑSOÜÜ[’[XYÙ\ÈHÚ[\Ú[\˜YÜ˜\“\È[XYÙ\ÈZY[0èÝZ]œ™HH°êYðê]][Û‹ˆ[\È™H™[\XÙ[\È[™HY\Ý\™H]HÚ[\]¸ &Y[™[[œÈH™[™[Y[]YHÚH]\ˆ\ØYÙH\ÝØÝ[Y[0êKÒ[\˜YÜ˜\Ù]\˜Ù[^Y\œÈÛÛ™šYÏ^ØÛÛ™šYßH\ÜÙ\ÜÛY[^Ü[Ë›[™ÏØÛÛ™šYË›[™\ÜÙ\ÜÛY[HÛ“X\^ÛÛ“X\KÏÏŸ^ØY˜[˜ÙYšY]ÏOOIÛ›Ý\ÉÉ‰šY[›ÝX›ÛÚÈÛÛ™šYÏ^ØÛÛ™šYßHÛÚ[™ÙO^ÛÛÚ[™Ù_KÏ\ØÛÜÝ\™H]OH”ZY\È]\œ›ÜØYÙ\È°êX[\ðê\Èˆ\ØÜš\[Û^Ø	Ù]™[Ë™š[\ŠOO™KœÝ]\ÏOOIÛYX\Ý\™Y	ßKœÝ]\ÏOOIÙXÛ\™Y	ÊK›[™ÝHØœÙ\˜][ÛŠÊHÝH\Ü
ÊH[œ™YÚ\Ý°êJÊXO]ÛˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\žHˆÛÛXÚÏ^Ê
OO›ÛY˜[˜ÙY
	ÜÝZ]šIÊ_O“Ý]œš\ˆHØ\›™]8 &YX]H›ÙXÝXÛÛˆ˜[YOH˜\œ›ÝÈˆÚ^™O^ÌMŸKÏØ]ÛÑ\ØÛÜÝ\™O\ØÛÜÝ\™H]OH‘\ÜØZ\ÈÛÛ\\˜]YœÈ]HÚ[\ˆ\ØÜš\[ÛH‘ØÝ[Y[\ˆ[ˆ›ÝØÛÛH]\È°ê\Ý[]ÈØœÙ\°ê\ÈšY[šX[ÈÛÛ™šYÏ^ØÛÛ™šYßHÛÚ[™ÙO^ÛÛÚ[™Ù_KÏÑ\ØÛÜÝ\™OÏŸ^ØY˜[˜ÙYšY]ÏOOIÜÙ][™ÜÉÉ‰]ˆÛ\ÜÓ˜[YOH›[Ù[KZ[›ÈÜ[ˆÛ\ÜÓ˜[YOHœ›ÙXÝY^YXœ›ÝÈQ‘’S‘TˆHÒSUSUSÓÜÜ[”\˜[pê™\È]Û›°êY\ÏÚ[\˜YÜ˜\“\È˜[]\œÈ°ê\™[\Y\ÈÛÛ\ÈÚ[ÈH0ê\\ˆ™]›Ý]™^ˆXÚH]\ˆÜšYÚ[™H]\È°êYÛYÙ\È0ê]Z[0ê\ËÒ[\˜YÜ˜\Ù]]ˆÛ\ÜÓ˜[YOHœÙ][™ÜË\ÚÜÝ]ÈžÖÖÉÜ\˜Ù[IË	ÛXY‰Ë	ÐÝ[\™H]ÞXÛI×KÉÜÛÛ	Ë	ÝØ]\‰Ë	ÔÛÛ]\œšYØ][Û‰×KÉÛY][ÉË	ÜÝ[‰Ë	Ópê]0ê[ÈHHØ[\YÛ™I×KÉØÛÛœÙZ[ÉË	ØÛØÚÉË	Ñ]\ÈHÙ[Z\É×KÉÜ[‰Ë	Ùš[IË	ÐØ[[™šY\ˆ0ê]Z[0êI×KÉÙšXÚY\œÉË	ÜØ]™IË	Ò[\Ü\ˆ]^Ü\‰×WK›X\

ÚYXÛÛ‹X™[JOO]ÛˆÙ^O^ÚYHÛÛXÚÏ^Ê
OO›ÛY˜[˜ÙY
Y
_O›ÙXÝXÛÛˆ˜[YO^ÚXÛÛŸKÏÜ[žÛX™[OÜÜ[›ÙXÝXÛÛˆ˜[YOH˜\œ›ÝÈˆÚ^™O^ÌMŸKÏØ]ÛŠ_OÙ]\ØÛÜÝ\™H]OH“ÜšYÚ[™H]Ý]]HY\ÈÛ›°êY\È[œ]Ý]\ÈÛÛ™šYÏ^ØÛÛ™šYßHÛÚ[™ÙO^ÛÛÚ[™Ù_KÏÑ\ØÛÜÝ\™O\ØÛÜÝ\™H]OH”°êY°ê\™[˜Ù\È˜][Û˜[\È]Û›°êY\ÈX[œ]X[\È]PÛÛ\][ÛˆÛÛ™šYÏ^ØÛÛ™šYßH]™[Ï^Ù]™[ßHÛÚ[™ÙO^ÛÛÚ[™Ù_KÏÑ\ØÛÜÝ\™O\ØÛÜÝ\™H]OH‘XYÛ›ÜÝXÈ]Øðê[˜\š[ÜÈYÜ›Û›ÛZ\]Y\ÈYÜ›Û›ÛZXÔ[™[ÛÛ™šYÏ^ØÛÛ™šYßH]™[Ï^Ù]™[ßHÛÚ[™ÙO^ÛÛÚ[™Ù_KÏÑ\ØÛÜÝ\™O\ØÛÜÝ\™H]OH”°êYÛYÙ\È˜\Y\ÈHÛÛ]H8 &YX]H]ˆÛ\ÜÓ˜[YOH™›Ü›KYÜšYX™[Û\ÜÓ˜[YOH™šY[Ü[œX]H
x $ÌMHÛJOÜÜ[[œ]\OH›[X™\ˆˆZ[HŒˆX^HŒMˆÝ\HŒŒHˆ˜[YO^ÜÏÉÉßHÛÚ[™ÙO^ÙOOœÙ]
K\™Ù]˜[YJ_KÏÛX™[X™[Û\ÜÓ˜[YOH™šY[Ü[”°ê\Ù\™H[š]X[HˆÙ›]
™\Ù\™T\˜Ù[
_H	OÜÜ[[œ]\OHœ˜[™ÙHˆZ[HŒˆX^HŒLˆ˜[YO^Ü™\Ù\™T\˜Ù[ÏÍŒHÛÚ[™ÙO^ÙOO›ÛÚ[™ÙJË‹‹˜ÛÛ™šYËÛÚ[žË‹‹˜ÛÛ™šYËœÛÚ[^Y\œÎ˜ÛÛ™šYËœÛÚ[›^Y\œË›X\
OŠË‹‹›[š]X[]N›]UÔ
Ó[X™\ŠK\™Ù]˜[YJKÌL
Š]QË[]UÔ
_JJ__J_KÏÛX™[X™[Û\ÜÓ˜[YOH™šY[Ü[‘Y™šXØXÚ]0êH8 &X\œ›ÜØYÙHˆÙ›]

ÛÛ™šYËœÞ\Ý[K˜\XØ][Û‘Y™šXÚY[˜ÞOÏËÍJJŒL
_H	OÜÜ[[œ]\OHœ˜[™ÙHˆZ[HŒLˆX^HŒLˆ˜[YO^ÊÛÛ™šYËœÞ\Ý[K˜\XØ][Û‘Y™šXÚY[˜ÞOÏËÍJJŒLHÛÚ[™ÙO^ÙOO›ÛÚ[™ÙJË‹‹˜ÛÛ™šYËÞ\Ý[NžË‹‹˜ÛÛ™šYËœÞ\Ý[K\XØ][Û‘Y™šXÚY[˜ÞN“[X™\ŠK\™Ù]˜[YJKÌL_J_KÏÛX™[Ù]]ˆÛ\ÜÓ˜[YOH™›Ü›KXXÝ[ÛœÈ]ÛˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\žHˆÛÛXÚÏ^Ê
OO˜Û[X]PÚ[™ÙJ	Ü˜Z[“[IËŽ
_O”Øðê[˜\š[ÈˆZYH8¢$ŒŒ	OØ]Û]ÛˆÛ\ÜÓ˜[YOH˜ˆÙXÛÛ™\žHˆÛÛXÚÏ^Ê
OO˜Û[X]PÚ[™ÙJ	Ù][IËKŒJ_O”Øðê[˜\š[ÈˆU
ÌL	OØ]ÛÙ][\˜YÜ˜\Ù\È[ÙYšXØ][ÛœÈÜ°êY[\È\Ý0êÙ\Ëˆ[\È™H]šY[›™[\È\ÈY\Ý\™\ÈHÚ[\Ò[\˜YÜ˜\Ñ\ØÛÜÝ\™OÏŸOÏŸBˆÙ]‚ˆ\ØÛÜÝ\™H]OH”ÛÝ\˜Ù\È][Z]\ÈHÙ]HÚ[][][Ûˆˆ\ØÜš\[ÛH”Øðê[˜\š[È[™XØ]Y‹0è°ê\šYšY\ˆ]HÚ[\[\˜YÜ˜\”ÛÛˆØÛÛ™šYËœÛÚ[œÛÝ\˜Ù_Kˆpê]0ê[ÈˆÛ›°êY\È\ÜÛšX›\È0èH]HHÛÛœÙZ[ˆ[™H\Ý[X][ÛˆØ\ÙÜ˜\\]YH™H™[\XÙH\È[™H[˜[\ÙHHX›Ü˜]Ú\™KÒ[\˜YÜ˜\žÙ[š\›Û›Y[ËØ\›š[™ÜË›X\
ÏO[\˜YÜ˜\Ù^O^ÝßOžÝßOÒ[\˜YÜ˜\Š_O[\˜YÜ˜\“H[Ü[]0êH]\È0êYðèÈ8 &Z[›Û™][Ûˆ™HÛÛ\ÈØ[Ý[0ê\Ëˆ\ÈY™™]È\È›ÙZ]È™\Ý[ÛÛ™][Û›°ê\È]^[Ù0ê\È\ÜÛšX›\ÈÝ\ˆHÝ[\™KÒ[\˜YÜ˜\žÜ[Ë›Z\ÜÚ[™Ë›X\

KJOO[\˜YÜ˜\Ù^O^Ú_OžÛ_OÒ[\˜YÜ˜\Š_^Ý\ØX›I‰[\˜YÜ˜\žÚ[™XØ]Ü‹œ\˜Ù[H	H\È™\ÛÚ[œÈÛÝ]™\ÈÚHH[ˆ\Ý°êX[\ðêKˆÝ\™˜XÙH][\ðêYHÝ\ˆÙHš[[ˆˆÙ›]
Ý™\šY]Ë˜\™XSLOO[[Û[›Ý™\šY]Ë˜\™XSL‹ÌLÊ_HKÒ[\˜YÜ˜\ŸOH™YHšÎ‹ËÙØÜËš\ÜšXË›Ü™ËÙÛØ˜[]KÜÛÚ[ÜšYËÈˆ\™Ù]H—Ø›[šÈˆ™[H››Ü™Y™\œ™\ˆ’TÔ’PÈÛÚ[ÜšYÏØOˆ0­ÈH™YHšÎ‹ËÛÜ[‹[Y][Ë˜ÛÛKÈˆ\™Ù]H—Ø›[šÈˆ™[H››Ü™Y™\œ™\ˆ“Ü[‹SY][È0­ÈÐÈ–HŒØOÑ\ØÛÜÝ\™O‚ˆÏŸBˆÙ]ŽÂŸB