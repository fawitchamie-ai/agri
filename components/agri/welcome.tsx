'use client';
import {ProductBrand,ProductIcon} from './product-ui';
import './welcome.css';

type WelcomeProps={onStart:()=>void;onCampaigns:()=>void;onReferences:()=>void};

const countries=['Togo','Bénin','Burkina Faso','Ghana','Côte d’Ivoire','Sénégal'];

export default function Welcome({onStart,onCampaigns,onReferences}:WelcomeProps){
 return <div className="welcome-page field-home home-workspace">
  <header className="home-topbar">
   <div className="home-brand"><ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/><span className="home-brand-divider"/><span className="home-space-name">Espace agricole</span></div>
   <nav className="home-nav" aria-label="Navigation principale">
    <button className="is-current" aria-current="page">Mes champs</button>
    <button onClick={onCampaigns}>Campagnes</button>
    <button onClick={onReferences}>Données agricoles</button>
   </nav>
   <div className="home-top-actions">
    <button className="home-campaign-action" onClick={onCampaigns}><ProductIcon name="file" size={17}/><span>Mes campagnes</span></button>
    <button className="home-new-action" onClick={onStart}><ProductIcon name="plus" size={17}/><span>Nouvelle campagne</span></button>
   </div>
  </header>

  <main className="home-workbench">
   <aside className="home-fields-panel" aria-labelledby="home-title">
    <div className="home-panel-caption"><span><i/> Votre espace de travail</span><span className="home-country-count">6 pays</span></div>
    <div className="home-fields-heading">
     <div><h1 id="home-title">Mes champs</h1><p>Choisissez une parcelle ou ajoutez-en une.</p></div>
    </div>

    <section className="home-empty-field" aria-labelledby="empty-field-title">
     <span className="home-empty-symbol"><ProductIcon name="map" size={23}/></span>
     <div className="home-empty-copy"><h2 id="empty-field-title">Commencer par un champ</h2><p>Recherchez votre village, puis dessinez le contour de la parcelle sur la carte.</p></div>
     <button className="home-primary-action" onClick={onStart}><span>Localiser mon champ</span><ProductIcon name="arrow" size={17}/></button>
     <div className="home-field-hint"><span>01</span><span>La surface sera calculée après le tracé.</span></div>
    </section>

    <section className="home-campaign-link" aria-label="Campagnes enregistrées">
     <span className="home-campaign-icon"><ProductIcon name="file" size={19}/></span>
     <div><strong>Campagnes</strong><span>Reprendre ou consulter une campagne</span></div>
     <button aria-label="Ouvrir mes campagnes" onClick={onCampaigns}><ProductIcon name="arrow" size={16}/></button>
    </section>

    <div className="home-fields-panel-footer">
     <div className="home-country-heading"><span>Pays couverts</span><button onClick={onReferences}>Voir les données <ProductIcon name="arrow" size={13}/></button></div>
     <ul className="home-country-list">{countries.map(country=><li key={country}><i aria-hidden="true"/>{country}</li>)}</ul>
     <p>Les informations disponibles varient selon le pays, la culture et la campagne.</p>
    </div>
   </aside>

   <section className="home-map-panel" aria-labelledby="home-map-title">
    <div className="home-map-toolbar">
     <div className="home-map-heading"><span>CARTE DE LOCALISATION</span><h2 id="home-map-title">Afrique de l’Ouest</h2></div>
     <button className="home-map-open" onClick={onStart}><ProductIcon name="map" size={16}/><span>Ouvrir la carte</span></button>
    </div>
    <div className="home-map-canvas">
     <div className="home-map-graticule" aria-hidden="true"/>
     <div className="home-map-top-note"><span className="home-map-status-dot"/><span>Six pays disponibles</span></div>
     <img className="home-coverage-map" src="/images/west-africa-coverage.svg" alt="Carte de l’Afrique de l’Ouest. Les pays en bleu font partie de la zone couverte par AgriPrévision."/>
     <div className="home-map-instruction"><span className="home-map-instruction-icon"><ProductIcon name="map" size={19}/></span><span><strong>Votre champ, sur la carte</strong><small>Recherchez un lieu ou dessinez son contour.</small></span><button onClick={onStart} aria-label="Commencer la localisation du champ"><ProductIcon name="arrow" size={17}/></button></div>
     <div className="home-map-legend"><span><i className="home-legend-covered"/> Pays couverts</span><span><i className="home-legend-other"/> Autres pays</span></div>
    </div>
    <div className="home-map-footnote"><span>Carte de repérage · les limites affichées ne sont pas des limites foncières.</span><button onClick={onReferences}>Comprendre les données <ProductIcon name="arrow" size={13}/></button></div>
   </section>
  </main>

  <footer className="home-footer"><span>AgriPrévision <i/> Terres d’Afrique</span><span>Un même espace pour localiser le champ, préparer la campagne et lire les résultats.</span></footer>
 </div>;
}
