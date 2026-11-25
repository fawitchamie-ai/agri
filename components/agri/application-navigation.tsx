'use client';
import {ProductBrand,ProductIcon} from './product-ui';
import type {CooperativeAccess} from '../../lib/contracts';

type Item=[string,string,string?];
const sections=[
 {title:'Décisions et cartes',icon:'chart',items:[['yield','Rendement et production','chart'],['water','Décider · semis et eau','water'],['fertilizer','Engrais','leaf']] as Item[]},
 {title:'Coopérative',icon:'people',items:[['recoltes','Récoltes réelles','basket'],['collecte','Collectes et logistique','basket'],['gestion','Ma coopérative','people'],['fiche','Bilan de campagne','file']] as Item[]},
 {title:'Données et méthodes',icon:'book',items:[['dashboard','Vue d’ensemble','chart'],['atlas','Atlas des rendements','map'],['previsions','Estimations historiques','chart'],['comparaison','Comparer les campagnes','chart'],['models','Modèles et résultats','settings'],['quality','Qualité des données','check'],['lineage','Origine des résultats','file'],['explorer','Catalogue des données','book'],['simulation','Convertir un rendement','settings'],['import','Importer des données','file'],['guide','Guide pratique','book']] as Item[]},
];

export default function ApplicationNavigation({view,onNavigate,onClose,name,cooperatives=[],activeCoopId,demo=false,onSwitchCooperative}:{view:string;onNavigate:(view:string)=>void;onClose:()=>void;name:string;cooperatives?:CooperativeAccess[];activeCoopId?:string;demo?:boolean;onSwitchCooperative?:(coopId:string)=>void}){
 function item([id,label,icon]:Item){return <button key={id} className={'product-nav-item'+(view===id?' active':'')} aria-current={view===id?'page':undefined} onClick={()=>onNavigate(id)}>{icon&&<ProductIcon name={icon}/>}<span>{label}</span>{view===id&&<i/>}</button>;}
 const roleName:Record<string,string>={responsable:'Responsable',admin:'Administrateur',agent:'Agent',producteur:'Producteur'};
 return <aside className="product-sidebar no-print"><div className="product-sidebar-brand"><ProductBrand onClick={()=>onNavigate('home')}/><button className="product-nav-close" aria-label="Fermer la navigation" onClick={onClose}><ProductIcon name="close"/></button></div><nav aria-label="Navigation principale">
  <span className="sidebar-section-label">MES CHAMPS</span>
  {item(['home','Carte des champs','map'])}
  {item(['monitoring','Suivi satellite','satellite'])}
  {item(['zones','Zones historiques','grid'])}
  {item(['doses','Cartes de doses','chart'])}
  {item(['notes','Carnet terrain','book'])}
  <div className="sidebar-separator"/>
  <span className="sidebar-section-label">CAMPAGNES</span>
  {item(['campaigns','Mes campagnes','file'])}
  {item(['seasonal','Parcelle et campagne','leaf'])}
  <div className="sidebar-separator"/>
  {sections.map(g=><details className="product-nav-group" key={g.title} open={g.items.some(([id])=>id===view)||undefined}><summary><ProductIcon name={g.icon}/><span>{g.title}</span><b aria-hidden="true">⌄</b></summary><div>{g.items.map(item)}</div></details>)}
 </nav><div className="product-sidebar-bottom">{cooperatives.length>1&&<label className="product-workspace-switcher"><span>Espace actif</span><select aria-label="Espace de travail actif" value={activeCoopId||''} onChange={event=>onSwitchCooperative?.(event.target.value)}>{cooperatives.map(space=><option key={space.coopId} value={space.coopId}>{space.name} · {roleName[space.role]||space.role}</option>)}</select></label>}<button onClick={()=>onNavigate('guide')}><ProductIcon name="book"/><span>Besoin d’aide ?<small>Consulter le guide pratique</small></span><ProductIcon name="arrow" size={15}/></button><div className="product-profile"><span>{name.slice(0,1).toUpperCase()}</span><div><strong>{name}</strong><small>{demo?'Espace de démonstration':cooperatives.length?'Compte Cloudflare Access':'Aucun espace ouvert'}</small></div>{!demo&&cooperatives.length>0&&<a className="product-account-logout" href="/cdn-cgi/access/logout">Déconnexion</a>}</div></div></aside>;
}
