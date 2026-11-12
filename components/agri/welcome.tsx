'use client';
import {ProductBrand, ProductIcon} from './product-ui';
import './welcome.css';

const steps = [
  {number:'01', icon:'map', title:'Localisez votre parcelle', description:'Recherchez votre champ et dessinez son contour sur la carte.'},
  {number:'02', icon:'leaf', title:'Préparez votre campagne', description:'Choisissez votre culture et renseignez les informations disponibles.'},
  {number:'03', icon:'chart', title:'Explorez vos résultats', description:'Consultez le rendement estimé, la production et les besoins en eau lorsque le calcul est possible.'},
];
const tools = [
  {icon:'chart', title:'Rendement & production', description:'Découvrez ce que votre campagne pourrait produire selon les données et hypothèses disponibles.', label:'SIMULER'},
  {icon:'water', title:'Eau & dates de semis', description:'Visualisez les besoins de la culture et comparez les scénarios hydriques disponibles.', label:'COMPARER'},
  {icon:'leaf', title:'Engrais & apports', description:'Préparez vos apports et explorez leur effet quand un modèle le permet.', label:'PRÉPARER'},
  {icon:'satellite', title:'Images satellites', description:'Observez votre parcelle et retrouvez les images disponibles avec leurs limites.', label:'OBSERVER'},
];
const countries=['Togo','Bénin','Burkina Faso','Ghana','Côte d’Ivoire','Sénégal'];

export default function Welcome({onStart,onReferences}:{onStart:()=>void;onReferences:()=>void}) {
 return <div className="welcome-page ag-home">
  <header className="ag-home-header">
   <ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/>
   <nav aria-label="Découvrir AgriPrévision"><a href="#comment">Comment ça marche</a><a href="#fonctionnalites">Les outils</a><a href="#territoires">Territoires</a></nav>
   <button className="ag-home-header-action" onClick={onStart}>Accéder à mon espace <ProductIcon name="arrow" size={17}/></button>
  </header>
  <main>
   <section className="ag-home-hero" aria-labelledby="home-title">
    <div className="ag-home-hero-inner">
     <div className="ag-home-copy">
      <span className="ag-home-eyebrow"><span aria-hidden="true"/> L’AGRICULTURE, AVEC UNE LONGUEUR D’AVANCE</span>
      <h1 id="home-title">Vos champs.<br/><span>Vos décisions.</span><br/>Une vision plus claire.</h1>
      <p>Du contour de votre parcelle aux perspectives de récolte, retrouvez les informations utiles pour préparer votre campagne.</p>
      <div className="ag-home-actions"><button className="ag-home-primary" onClick={onStart}>Commencer une simulation <ProductIcon name="arrow" size={19}/></button><button className="ag-home-resume" onClick={onStart}>Reprendre ma campagne <ProductIcon name="arrow" size={17}/></button></div>
      <div className="ag-home-note"><ProductIcon name="book" size={19}/><p>Le rendement et la production sont des estimations conditionnelles : leur disponibilité dépend des données renseignées et du modèle.</p></div>
     </div>
     <div className="ag-home-visual">
      <figure className="ag-home-image"><img src="/images/fields-mosaic.webp" alt="Vue aérienne de parcelles agricoles, photographie d’illustration" width="1000" height="666" fetchPriority="high"/><figcaption>PHOTOGRAPHIE D’ILLUSTRATION</figcaption></figure>
      <div className="ag-home-float"><div className="ag-home-float-icon"><ProductIcon name="chart" size={21}/></div><div><strong>La campagne commence ici</strong><span>Parcelle → Culture → Résultats</span></div><ProductIcon name="arrow" size={17}/></div>
     </div>
    </div>
    <div className="ag-home-bottom"><span><ProductIcon name="map" size={17}/> Pensé pour vos parcelles</span><span><ProductIcon name="chart" size={17}/> Des résultats expliqués</span><span><ProductIcon name="satellite" size={17}/> Des observations à explorer</span></div>
   </section>
   <section className="ag-home-journey ag-home-container" id="comment">
    <div className="ag-home-heading"><div><span className="ag-home-label">VOTRE POINT DE DÉPART</span><h2>De la parcelle<br/><span>à la récolte envisagée.</span></h2></div><p>Vous n’avez pas besoin de tout connaître pour commencer. Créez votre campagne, puis complétez les informations au fur et à mesure.</p></div>
    <div className="ag-home-steps">{steps.map(step=><article key={step.number}><div className="ag-home-step-top"><span>{step.number}</span><span className="ag-home-step-icon"><ProductIcon name={step.icon} size={23}/></span></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
    <button className="ag-home-text-action" onClick={onStart}>Commencer avec ma parcelle <ProductIcon name="arrow" size={17}/></button>
   </section>
   <section className="ag-home-tools" id="fonctionnalites"><div className="ag-home-container">
    <div className="ag-home-heading"><div><span className="ag-home-label">TOUT AU MÊME ENDROIT</span><h2>Comprendre aujourd’hui.<br/><span>Préparer la suite.</span></h2></div><p>Chaque outil vous aide à répondre à une question concrète sur votre campagne.</p></div>
    <div className="ag-home-tool-grid">{tools.map(tool=><article key={tool.title}><div className="ag-home-tool-icon"><ProductIcon name={tool.icon} size={24}/></div><span className="ag-home-tool-label">{tool.label}</span><h3>{tool.title}</h3><p>{tool.description}</p></article>)}</div>
    <p className="ag-home-disclaimer">Les résultats dépendent des données disponibles. Certains effets, notamment ceux des engrais, restent exploratoires ou ne sont pas calculables selon la culture et la zone.</p>
   </div></section>
   <section className="ag-home-territories ag-home-container" id="territoires"><div><span className="ag-home-label">AFRIQUE DE L’OUEST</span><h2>Un outil pour<br/><span>vos territoires.</span></h2><p>AgriPrévision couvre six pays. Les données et les modèles disponibles varient selon la culture, la zone et les sources.</p><ul>{countries.map(country=><li key={country}>{country}</li>)}</ul><button className="ag-home-text-action" onClick={onReferences}>Explorer les références de rendement <ProductIcon name="arrow" size={17}/></button></div><figure><img src="/images/west-africa-coverage.svg" alt="Carte des six pays couverts : Sénégal, Côte d’Ivoire, Ghana, Togo, Bénin et Burkina Faso" width="640" height="410" loading="lazy"/><figcaption>Périmètre géographique d’AgriPrévision</figcaption></figure></section>
   <section className="ag-home-final"><div><span className="ag-home-label">PRÊT À COMMENCER ?</span><h2>Votre prochaine campagne<br/>prend forme ici.</h2><p>Créez une simulation ou reprenez votre travail là où vous l’avez laissé.</p></div><button className="ag-home-final-button" onClick={onStart}>Accéder à mon espace <ProductIcon name="arrow" size={18}/></button></section>
  </main>
  <footer className="ag-home-footer"><ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/><p>Observer. Comprendre. Décider.</p><details><summary>Crédit photographique</summary><p>Vue aérienne : Sathsara Priyankara, <a href="https://unsplash.com/photos/an-aerial-view-of-a-lush-green-field-Y4e4PTUvgHw" target="_blank" rel="noreferrer">Unsplash</a>, photographie d’illustration.</p></details><a href="#home-title">Retour en haut ↑</a></footer>
 </div>;
}
