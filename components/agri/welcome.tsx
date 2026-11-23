'use client';
import {useMemo,useState} from 'react';
import {ProductIcon} from './product-ui';
import FieldOverviewMap from './field-overview-map';
import {COUNTRIES,type CampaignSummary} from '../../lib/seasonal/types';
import './welcome.css';

type WelcomeProps={campaigns:CampaignSummary[];selectedCampaignId:string;onSelectCampaign:(id:string)=>void;campaignsLoaded:boolean;campaignsError?:string;onRetry?:()=>void;onOpenDemo?:()=>void;demoBusy?:boolean;onStart:()=>void;onCampaigns:()=>void;onReferences:()=>void;onOpenCampaign:(id:string,section:'images'|'map')=>void};
const crops:Record<string,string>={Maize:'Maïs',Rice:'Riz',Sorghum:'Sorgho',Millet:'Mil',Cassava:'Manioc',Yam:'Igname',Beans:'Haricot',Groundnuts:'Arachide',Cowpea:'Niébé',Soybean:'Soja'};
const dateLabel=(value?:string)=>value?new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'Date non renseignée';
const hasGeometry=(campaign?:CampaignSummary)=>!!campaign?.geometry?.coordinates?.[0]&&campaign.geometry.coordinates[0].length>=4;
const areaLabel=(area?:number|null)=>area&&area>0?`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(area/10000)} ha`:null;

export default function Welcome({campaigns,selectedCampaignId,onSelectCampaign,campaignsLoaded,campaignsError='',onRetry=()=>{},onOpenDemo=()=>{},demoBusy=false,onStart,onCampaigns,onReferences,onOpenCampaign}:WelcomeProps){
 const [query,setQuery]=useState(''),[mobileView,setMobileView]=useState<'fields'|'map'>('fields');
 const filtered=useMemo(()=>campaigns.filter(c=>`${c.name} ${c.crop} ${COUNTRIES[c.country]?.name||''} ${c.territory||''}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))),[campaigns,query]);
 const activeId=filtered.some(c=>c.id===selectedCampaignId)?selectedCampaignId:(filtered[0]?.id||'');
 const selected=campaigns.find(c=>c.id===activeId),selectedHasGeometry=hasGeometry(selected);
 return <div className="welcome-page field-home home-workspace">
  <header className="home-dashboard-heading">
   <div className="home-title-block"><span className="product-eyebrow">MON EXPLOITATION</span><h1>Mes champs</h1><p>Choisissez une parcelle pour voir son contour et accéder à son suivi.</p></div>
   <button className="btn primary home-add-field" onClick={onStart}><ProductIcon name="plus" size={17}/>Ajouter un champ</button>
  </header>
  <div className="home-view-switch" role="tablist" aria-label="Affichage des champs">
   <button role="tab" aria-selected={mobileView==='fields'} className={mobileView==='fields'?'active':''} onClick={()=>setMobileView('fields')}><ProductIcon name="grid" size={16}/>Mes champs{campaigns.length>0&&<b>{campaigns.length}</b>}</button>
   <button role="tab" aria-selected={mobileView==='map'} className={mobileView==='map'?'active':''} onClick={()=>setMobileView('map')}><ProductIcon name="map" size={16}/>Carte</button>
  </div>
  <main className="home-workbench">
   <aside className={'home-fields-panel'+(mobileView==='map'?' mobile-hidden':'')} aria-labelledby="home-title">
    <div className="home-fields-heading"><div><h2 id="home-title">Vos champs</h2><p>{campaignsLoaded?`${campaigns.length} champ${campaigns.length===1?'':'s'}`:campaignsError?'Espace à ouvrir':'Chargement de vos champs…'}</p></div><button className="home-inline-action" onClick={onCampaigns}>Campagnes <ProductIcon name="arrow" size={14}/></button></div>
    <label className="home-search"><ProductIcon name="search" size={17}/><span className="sr-only">Rechercher un champ</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un champ" aria-label="Rechercher un champ"/></label>
    <div className="home-fields-section-label"><span>TOUS LES CHAMPS</span><span>{filtered.length}</span></div>
    <div className="home-field-list" aria-label="Liste des champs">
     {filtered.map(c=>{const active=c.id===activeId;return <button className={'home-field-card'+(active?' selected':'')} key={c.id} aria-pressed={active} onClick={()=>{onSelectCampaign(c.id);setMobileView('map')}}>
      <span className="home-field-card-symbol"><ProductIcon name="leaf" size={16}/></span>
      <span className="home-field-card-copy"><strong>{c.name||'Mon champ'}</strong><small>{crops[c.crop]||c.crop} <i/> {COUNTRIES[c.country]?.name||c.country}</small><small>{areaLabel(c.areaM2)||'Surface inconnue'} <i/> {c.territory||'Localité non précisée'}</small></span>
      <span className={'home-field-status'+(hasGeometry(c)?' located':'')} title={hasGeometry(c)?'Contour enregistré':'Contour à renseigner'}><i/></span>
     </button>;})}
     {!campaignsLoaded&&!campaignsError&&<div className="home-fields-skeleton" aria-label="Chargement des parcelles"><i/><i/><i/></div>}
     {campaignsError&&(()=>{const publicVisitor=/connectez-vous|démonstration/i.test(campaignsError);return <section className="home-empty-field"><span className="home-empty-symbol"><ProductIcon name={publicVisitor?'leaf':'refresh'} size={20}/></span><div className="home-empty-copy"><h3>{publicVisitor?'Bienvenue sur AgriPrévision':'Vos champs n’ont pas pu être chargés'}</h3><p>{publicVisitor?'Connectez-vous par e-mail via Cloudflare Access pour ouvrir votre espace personnel. La première connexion autorisée crée votre compte et un espace isolé. Vous pouvez aussi explorer la démonstration sans compte ; ses données sont fictives.':campaignsError}</p></div><div className="home-empty-actions">{publicVisitor?<><a className="home-primary-action home-login-action" href="/api/auth/login?returnTo=%2F">Se connecter par e-mail <ProductIcon name="arrow" size={16}/></a><button className="home-secondary-action" disabled={demoBusy} onClick={onOpenDemo}>{demoBusy?'Ouverture…':'Explorer la démonstration'}</button></>:<button className="home-secondary-action" disabled={demoBusy} onClick={onRetry}>Réessayer</button>}</div></section>})()}
     {campaignsLoaded&&campaigns.length===0&&<section className="home-empty-field"><span className="home-empty-symbol"><ProductIcon name="map" size={20}/></span><div className="home-empty-copy"><h3>Aucun champ enregistré</h3><p>Tracez le contour d’une parcelle pour commencer son suivi.</p></div><button className="home-primary-action" onClick={onStart}>Tracer une parcelle <ProductIcon name="arrow" size={16}/></button></section>}
     {campaignsLoaded&&campaigns.length>0&&filtered.length===0&&<p className="home-no-results">Aucun champ ne correspond à « {query} ».</p>}
    </div>
    {selected&&<section className="home-selected-field" aria-label="Champ sélectionné">
     <div className="home-selected-heading"><span className="home-field-selected-mark"/><div><span>CHAMP SÉLECTIONNÉ</span><strong>{selected.name||'Mon champ'}</strong></div></div>
     <div className="home-selected-metadata"><span>{crops[selected.crop]||selected.crop}</span><span>{COUNTRIES[selected.country]?.name||selected.country}</span><span>{areaLabel(selected.areaM2)||'Surface inconnue'}</span></div>
     <p className="home-selected-date">Semis prévu · {dateLabel(selected.sowingDate)}</p>
     <button className="home-selected-action" onClick={()=>onOpenCampaign(selected.id,selectedHasGeometry?'images':'map')}><span>{selectedHasGeometry?'Ouvrir le suivi':'Délimiter la parcelle'}</span><ProductIcon name="arrow" size={17}/></button>
    </section>}
    <footer className="home-fields-footer"><button onClick={onReferences}><ProductIcon name="book" size={16}/><span>Données et méthodes</span><ProductIcon name="arrow" size={14}/></button><small>Les outils et leur couverture varient selon les données disponibles.</small></footer>
   </aside>
   <section className={'home-map-panel'+(mobileView==='fields'?' mobile-hidden':'')} aria-labelledby="home-map-title">
    <div className="home-map-toolbar"><div className="home-map-heading"><span>CARTE DE L’EXPLOITATION</span><h2 id="home-map-title">{selected?.name||'Mes parcelles'}</h2></div><button className="home-map-open" onClick={onStart}><ProductIcon name="plus" size={16}/><span>Ajouter</span></button></div>
    <div className="home-map-canvas">
     <FieldOverviewMap campaigns={campaigns} selectedId={activeId} onSelect={onSelectCampaign} visible/>
     {campaignsLoaded&&campaigns.length===0&&<div className="home-map-empty"><span className="home-map-empty-icon"><ProductIcon name="map" size={21}/></span><strong>Votre carte apparaîtra ici</strong><span>Ajoutez un champ et tracez son contour pour le retrouver sur la carte.</span><button onClick={onStart}>Ajouter un champ <ProductIcon name="arrow" size={15}/></button></div>}
     {selected&&!selectedHasGeometry&&<div className="home-map-notice"><span className="home-map-notice-icon"><ProductIcon name="map" size={18}/></span><span><strong>Contour à renseigner</strong><small>Ce champ n’a pas encore de limites enregistrées.</small></span><button onClick={()=>onOpenCampaign(selected.id,'map')}>Tracer <ProductIcon name="arrow" size={14}/></button></div>}
     {selectedHasGeometry&&<div className="home-map-selected-chip"><span/>Contour enregistré <b>·</b> {areaLabel(selected?.areaM2)||'surface inconnue'}</div>}
     {selected&&<div className="home-map-mobile-card"><div><span>CHAMP SÉLECTIONNÉ</span><strong>{selected.name||'Mon champ'}</strong><small>{crops[selected.crop]||selected.crop} · {COUNTRIES[selected.country]?.name||selected.country}</small></div><button onClick={()=>onOpenCampaign(selected.id,selectedHasGeometry?'images':'map')}>{selectedHasGeometry?'Ouvrir le suivi':'Tracer'} <ProductIcon name="arrow" size={15}/></button></div>}
    </div>
    <div className="home-map-footnote"><span>Contours issus des parcelles enregistrées dans votre espace.</span><button onClick={onCampaigns}>Toutes les campagnes <ProductIcon name="arrow" size={13}/></button></div>
   </section>
  </main>
 </div>;
}
