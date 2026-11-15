'use client';
import {useMemo,useState} from 'react';
import {ProductIcon} from './product-ui';
import {COUNTRIES,type CampaignSummary} from '../../lib/seasonal/types';
import './welcome.css';

type WelcomeProps={campaigns:CampaignSummary[];campaignsLoaded:boolean;onStart:()=>void;onCampaigns:()=>void;onReferences:()=>void;onOpenCampaign:(id:string)=>void};
const countries=Object.values(COUNTRIES).map(c=>c.name);
const crops:Record<string,string>={Maize:'Maïs',Rice:'Riz',Sorghum:'Sorgho',Millet:'Mil',Cassava:'Manioc',Yam:'Igname',Beans:'Haricot',Groundnuts:'Arachide',Cowpea:'Niébé',Soybean:'Soja'};
const dateLabel=(value?:string)=>value?new Date(value).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'Date non renseignée';

export default function Welcome({campaigns,campaignsLoaded,onStart,onCampaigns,onReferences,onOpenCampaign}:WelcomeProps){
 const [query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
 const filtered=useMemo(()=>campaigns.filter(c=>`${c.name} ${c.crop} ${COUNTRIES[c.country]?.name||''}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))),[campaigns,query]);
 return <div className="welcome-page field-home home-workspace">
  <header className="home-dashboard-heading"><div><span className="product-eyebrow">MON EXPLOITATION</span><h1>Mes champs</h1><p>Retrouvez vos parcelles et poursuivez leur suivi, de la préparation de campagne à la récolte.</p></div><button className="btn primary" onClick={onStart}><ProductIcon name="plus" size={17}/>Ajouter un champ</button></header>
  <main className="home-workbench">
   <aside className="home-fields-panel" aria-labelledby="home-title">
    <div className="home-fields-heading"><div><h2 id="home-title">Campagnes enregistrées</h2><p>{campaignsLoaded?`${campaigns.length} campagne${campaigns.length===1?'':'s'}`:'Chargées à la demande'}</p></div><button className="home-inline-action" onClick={onCampaigns}>{campaignsLoaded?'Tout voir':'Ouvrir la liste'} <ProductIcon name="arrow" size={14}/></button></div>
    {campaigns.length>0&&<div className="home-search"><ProductIcon name="map" size={16}/>{searchOpen?<><label className="sr-only" htmlFor="home-field-search">Rechercher un champ</label><input id="home-field-search" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un champ ou une culture"/><button className="home-search-close" aria-label="Fermer la recherche" onClick={()=>{setSearchOpen(false);setQuery('')}}>×</button></>:<button className="home-search-trigger" onClick={()=>setSearchOpen(true)}>Rechercher un champ ou une culture</button>}</div>}
    {filtered.length>0?<div className="home-field-list" aria-label="Vos campagnes">{filtered.map(c=><button className="home-field-card" key={c.id} onClick={()=>onOpenCampaign(c.id)}><span className="home-field-card-icon"><ProductIcon name="leaf" size={18}/></span><span className="home-field-card-copy"><strong>{c.name||'Mon champ'}</strong><small>{crops[c.crop]||c.crop} · {COUNTRIES[c.country]?.name||c.country}</small><small>Mis à jour le {dateLabel(c.updatedAt)} · rév. {c.revision}</small></span><ProductIcon name="arrow" size={16}/></button>)}</div>:<section className="home-empty-field"><span className="home-empty-symbol"><ProductIcon name="map" size={22}/></span><div className="home-empty-copy"><h3>{campaignsLoaded?'Aucun champ enregistré':'Aucune parcelle enregistrée à afficher avant le chargement'}</h3><p>{campaignsLoaded?'Ajoutez votre premier champ, choisissez la culture puis ouvrez son suivi satellite et son carnet.':'La liste complète se charge lorsque vous ouvrez vos campagnes.'}</p></div><button className="home-primary-action" onClick={onStart}><span>Localiser mon champ</span><ProductIcon name="arrow" size={17}/></button></section>}
    {query&&filtered.length===0&&campaigns.length>0&&<p className="home-no-results">Aucun champ ne correspond à « {query} ».</p>}
    <section className="home-campaign-link"><span className="home-campaign-icon"><ProductIcon name="book" size={18}/></span><div><strong>Données agricoles</strong><span>Sources, périodes et limites de couverture</span></div><button aria-label="Consulter les données agricoles" onClick={onReferences}><ProductIcon name="arrow" size={15}/></button></section>
    <div className="home-fields-panel-footer"><div className="home-country-heading"><span>Couverture par pays</span><button onClick={onReferences}>Détails <ProductIcon name="arrow" size={13}/></button></div><ul className="home-country-list">{countries.map(country=><li key={country}><i aria-hidden="true"/>{country}</li>)}</ul><p>La profondeur des séries varie selon le pays, la culture et la saison.</p></div>
   </aside>
   <section className="home-map-panel" aria-labelledby="home-map-title"><div className="home-map-toolbar"><div className="home-map-heading"><span>CARTE DE LOCALISATION · COUVERTURE DES OUTILS AGRICOLES</span><h2 id="home-map-title">Afrique de l’Ouest et Nigeria</h2></div><button className="home-map-open" onClick={onReferences}><ProductIcon name="map" size={16}/><span>Voir les données</span></button></div>
    <div className="home-map-canvas"><div className="home-map-graticule" aria-hidden="true"/><div className="home-map-top-note"><span className="home-map-status-dot"/><span>{countries.length} pays disponibles</span></div><img className="home-coverage-map" src="/images/west-africa-coverage.svg" alt="Pays couverts par les outils agricoles d’AgriPrévision. Cette carte présente une couverture régionale, pas les limites de parcelles."/><div className="home-map-instruction"><span className="home-map-instruction-icon"><ProductIcon name="satellite" size={19}/></span><span><strong>Suivre une parcelle</strong><small>Ajoutez son contour pour consulter les images et analyser son historique.</small></span><button onClick={onStart} aria-label="Ajouter une parcelle"><ProductIcon name="arrow" size={17}/></button></div><div className="home-map-legend"><span><i className="home-legend-covered"/> Couverture disponible</span><span><i className="home-legend-other"/> Hors périmètre actuel</span></div></div>
    <div className="home-map-footnote"><span>Carte régionale indicative · les contours fonciers sont à tracer séparément.</span><button onClick={onCampaigns}>Ouvrir mes campagnes <ProductIcon name="arrow" size={13}/></button></div>
   </section>
  </main>
 </div>;
}
