'use client';
import {useEffect,useState} from 'react';
import type {SeasonalConfig} from '../../lib/seasonal/types';
import {TOGO_MAIZE_VARIETIES,TOGO_MAIZE_VARIETY_SOURCE,varietyMaturityWindow} from '../../lib/seasonal/variety-options';
import {HelpParagraph} from './help-dialog';
const dateLabel=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
const hasMaize=(config:SeasonalConfig)=>{
 const id=config.cropProfile?.id??config.crop.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 return config.country==='TGO'&&(id==='maize'||id==='mais'||id.includes('mais'));
};
export default function VarietyComparison({config,onVarietyChange}:{config:SeasonalConfig;onVarietyChange?:(value:string)=>void}){
 const [available,setAvailable]=useState<string[]>([]),[retained,setRetained]=useState('');
 useEffect(()=>{setAvailable([]);setRetained('');},[config.country,config.crop,config.cropProfile?.id,config.sowingDate]);
 if(!hasMaize(config))return <section className="card" aria-label="Comparer les variétés disponibles"><span className="qs-eyebrow">DÉCISION · VARIÉTÉ</span><h2>Quel cycle peut finir à temps ?</h2><HelpParagraph>Aucun catalogue local de cycle vérifié n’est raccordé pour {config.crop} · {config.country}. Aucune variété ni durée n’est supposée.</HelpParagraph></section>;
 const chosen=TOGO_MAIZE_VARIETIES.filter(item=>available.includes(item.id));
 return <section className="card" aria-label="Comparer des variétés de maïs au Togo">
  <span className="qs-eyebrow">DÉCISION · VARIÉTÉ</span><h2>Quel cycle peut finir à temps ?</h2>
  <HelpParagraph>Maïs au Togo · cochez les semences que votre fournisseur confirme disponibles, puis comparez jusqu’à trois cycles.</HelpParagraph>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:8}}>
   {TOGO_MAIZE_VARIETIES.map(item=><label className="seasonal-check" key={item.id} style={{margin:0,alignItems:'flex-start'}}>
    <input type="checkbox" aria-label={'Semence '+item.name+' disponible pour moi'} checked={available.includes(item.id)} disabled={!available.includes(item.id)&&available.length>=3} onChange={e=>setAvailable(current=>e.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/>
    <span><strong>{item.name}</strong>{item.synonym?' · '+item.synonym:''}<br/>{item.daysMin}–{item.daysMax} jours · semis → maturité à 50 %</span>
   </label>)}
  </div>
  {!chosen.length&&<HelpParagraph className="source-note">Sélectionnez une à trois variétés réellement accessibles pour afficher leurs dates de maturité indicatives.</HelpParagraph>}
  {!!chosen.length&&<div className="table-wrap"><table className="data-table" aria-label="Calendrier indicatif des variétés sélectionnées"><thead><tr><th>Variété</th><th>Cycle de référence</th><th>Maturité à 50 % estimée</th><th>Campagne</th></tr></thead><tbody>{chosen.map(item=>{const window=varietyMaturityWindow(config.sowingDate,item.daysMin,item.daysMax);return <tr key={item.id}><td><strong>{item.name}</strong>{item.synonym&&<small className="seasonal-block">{item.synonym}</small>}</td><td>{item.daysMin}–{item.daysMax} jours</td><td>{dateLabel(window.from)} – {dateLabel(window.to)}</td><td><button type="button" className="btn secondary small" aria-label={'Retenir '+item.campaignName+' pour cette campagne'} disabled={!onVarietyChange} onClick={()=>{onVarietyChange?.(item.campaignName);setRetained(item.id);}}>Retenir</button>{retained===item.id&&<small className="seasonal-block" role="status">Ajoutée au brouillon</small>}</td></tr>;})}</tbody></table></div>}
  <details><summary>Source et limites</summary><HelpParagraph><a href={TOGO_MAIZE_VARIETY_SOURCE.url} target="_blank" rel="noreferrer">{TOGO_MAIZE_VARIETY_SOURCE.title}</a> · publié le 23 avril 2024. Les cycles sont semis–maturité à 50 %.</HelpParagraph><HelpParagraph>La liste décrit des cycles; elle ne confirme pas le stock actuel. Vérifiez le nom et la durée sur le lot acheté. La fin des pluies n’est pas comparée, car aucun calendrier local qualifié par préfecture et saison n’est raccordé.</HelpParagraph><HelpParagraph>Retenir une variété renseigne son nom dans la campagne. Le calendrier de stades du moteur reste inchangé : ajustez-le séparément avec une référence adaptée au lot.</HelpParagraph></details>
 </section>;
}
