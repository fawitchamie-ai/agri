'use client';
import {ProductBrand, ProductIcon} from './product-ui';
import './welcome.css';

const features = [
  {number:'01', title:'Ma parcelle', description:'Situez votre champ, dessinez son contour et consultez les données disponibles.', icon:'map'},
  {number:'02', title:'Ma campagne', description:'Renseignez la culture, les semis, le sol et les apports connus.', icon:'clock'},
  {number:'03', title:'Mes perspectives', description:'Explorez le rendement estimé et les périodes de besoin en eau.', icon:'chart'},
  {number:'04', title:'Mes décisions', description:'Comparez les scénarios disponibles et préparez vos interventions.', icon:'file'},
];
const countries=['Togo','Bénin','Burkina Faso','Ghana','Côte d’Ivoire','Sénégal'];

export default function Welcome({onStart,onReferences}:{onStart:()=>void;onReferences:()=>void}) {
 return <div className="welcome-page field-home">
  <header className="fh-header">
   <ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/>
   <nav aria-label="Présentation"><a href="#parcours">Comment ça marche</a><a href="#outils">À explorer</a><a href="#pays">Territoires</a></nav>
   <button className="fh-header-action" onClick={onStart}>Mon espace <ProductIcon name="arrow" size={16}/></button>
  </header>
  <main>
   <section className="fh-hero" aria-labelledby="home-title">
    <div className="fh-hero-copy">
     <span className="fh-kicker"><span aria-hidden="true"/> AIDE À LA DÉCISION AGRICOLE</span>
     <h1 id="home-title">Votre parcelle.<br/><span>Vos décisions.</span></h1>
     <p>Préparez votre campagne, explorez les perspectives de récolte et comparez les choix possibles pour votre champ.</p>
     <div className="fh-actions"><button className="fh-primary" onClick={onStart}>Commencer une simulation <ProductIcon name="arrow" size={18}/></button><a href="#parcours">Découvrir la démarche <span aria-hidden="true">↓</span></a></div>
     <div className="fh-reassurance"><ProductIcon name="info" size={17}/><span>Des simulations à interpréter selon vos données et hypothèses, pas une récolte garantie.</span></div>
    </div>
    <figure className="fh-hero-image"><img src="/images/ghana-maize-observation.webp" alt="Observation d’un épi de maïs dans un champ au Ghana" width="1000" height="750" fetchPriority="high"/><figcaption><span>Observer. Comprendre. Décider.</span><small>Ghana · photographie d’illustration</small></figcaption></figure>
   </section>
   <section className="fh-journey fh-container" id="parcours">
    <div className="fh-section-head"><div><span className="fh-label">UNE DÉMARCHE, QUATRE ÉTAPES</span><h2>De votre terrain<br/>à vos choix.</h2></div><p>Commencez par votre parcelle. Affinez ensuite les informations de campagne à votre rythme.</p></div>
    <div className="fh-steps">{features.map(feature=><article key={feature.number}><div className="fh-step-top"><span>{feature.number}</span><ProductIcon name={feature.icon} size={22}/></div><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div>
    <button className="fh-inline-action" onClick={onStart}>Commencer ou reprendre une simulation <ProductIcon name="arrow" size={17}/></button>
   </section>
   <section className="fh-explore" id="outils"><div className="fh-container fh-explore-inner">
    <div className="fh-explore-intro"><span className="fh-label">VOS OUTILS DE CAMPAGNE</span><h2>Les bonnes questions,<br/>au bon endroit.</h2><p>Un espace pour examiner les informations utiles à votre saison et retrouver les détails quand vous en avez besoin.</p><button className="fh-primary" onClick={onStart}>Ouvrir mon espace <ProductIcon name="arrow" size={18}/></button></div>
    <div className="fh-explore-list">
     <article><span>01</span><div><h3>Quelle récolte envisager ?</h3><p>Consultez le rendement simulé, les facteurs pris en compte et les limites du calcul.</p></div></article>
     <article><span>02</span><div><h3>Quand semer et apporter de l’eau ?</h3><p>Explorez les besoins en eau et comparez les scénarios disponibles pour votre campagne.</p></div></article>
     <article><span>03</span><div><h3>Comment préparer mes apports ?</h3><p>Renseignez vos engrais et leurs nutriments. Leur effet sur le rendement dépend de la disponibilité d’un modèle adapté.</p></div></article>
     <article><span>04</span><div><h3>Que montrent les images ?</h3><p>Consultez les observations disponibles en tenant compte de leur date, de leur résolution et des nuages.</p></div></article>
    </div>
   </div></section>
   <section className="fh-region fh-container" id="pays"><div><span className="fh-label">SIX PAYS D’AFRIQUE DE L’OUEST</span><h2>Un outil ancré<br/>dans vos territoires.</h2><p>Les données et les modèles disponibles varient selon le lieu, la culture et les sources.</p><ul>{countries.map(country=><li key={country}>{country}</li>)}</ul><button className="fh-inline-action" onClick={onReferences}>Explorer les références de rendement <ProductIcon name="arrow" size={17}/></button></div><figure><img src="/images/west-africa-coverage.svg" alt="Carte des six pays couverts : Sénégal, Côte d’Ivoire, Ghana, Togo, Bénin et Burkina Faso" width="640" height="410" loading="lazy"/><figcaption>Périmètre géographique d’AgriPrévision</figcaption></figure></section>
   <section className="fh-final"><div><span className="fh-label">À VOUS DE JOUER</span><h2>Votre prochaine campagne<br/>commence ici.</h2><p>Créez une simulation ou retrouvez vos campagnes dans votre espace.</p></div><button className="fh-light-button" onClick={onStart}>Accéder à mon espace <ProductIcon name="arrow" size={18}/></button></section>
  </main>
  <footer className="fh-footer"><ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/><p>Des outils pour observer, préparer et décider.</p><details><summary>Crédit photographique</summary><p>Photographie d’illustration : Christine Xuereb Seidu, Ghana, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Recadrage et compression WebP.</p></details><a href="#home-title">Retour en haut ↑</a></footer>
 </div>;
}
