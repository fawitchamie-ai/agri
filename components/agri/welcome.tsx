'use client';
import {useState} from 'react';
import {ProductBrand,ProductIcon} from './product-ui';
import './welcome.css';

const countries=['Togo','Bénin','Burkina Faso','Ghana','Côte d’Ivoire','Sénégal'];

const steps=[
 {number:'01',icon:'map',title:'Situez votre parcelle',text:'Choisissez le pays, trouvez votre champ et dessinez son contour sur la carte.'},
 {number:'02',icon:'leaf',title:'Préparez la campagne',text:'Sélectionnez la culture et la date de semis. Les données disponibles sont réunies pour votre scénario.'},
 {number:'03',icon:'chart',title:'Lisez ce qui est calculable',text:'Découvrez les indicateurs disponibles. Les tonnes restent masquées si aucune méthode de rendement ne peut les calculer.'},
];

const features=[
 {icon:'satellite',title:'Observer le terrain',text:'Consultez le contour, la répartition terre-eau et les images disponibles pour la parcelle.'},
 {icon:'water',title:'Préparer l’eau',text:'Suivez les besoins du cycle et comparez les scénarios d’apports lorsqu’un bilan est calculable.'},
 {icon:'basket',title:'Comprendre la récolte',text:'Les résultats dépendent de la culture, des données et du calcul disponible. Une parcelle seule ne garantit pas une estimation en tonnes.'},
];

export default function Welcome({onStart,onReferences}:{onStart:()=>void;onReferences:()=>void}){
 const [year,setYear]=useState<'2023'|'2011'>('2023');
 return <div className="welcome-page field-home">
  <header className="fh-header">
   <ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/>
   <button className="fh-header-action" onClick={onStart}>Commencer avec mon champ <ProductIcon name="arrow" size={17}/></button>
  </header>

  <main>
   <section className="fh-hero" aria-labelledby="home-title">
    <div className="fh-hero-copy">
     <span className="fh-eyebrow"><i aria-hidden="true"/> AGRIPRÉVISION <b/> TERRES D’AFRIQUE</span>
     <h1 id="home-title">Votre champ.<br/><span>Votre saison.</span><br/>En toute clarté.</h1>
     <p className="fh-hero-intro">Situez votre champ, choisissez ce que vous cultivez, puis consultez les résultats disponibles. Les détails et réglages restent accessibles quand vous en avez besoin.</p>
     <div className="fh-hero-actions">
      <button className="fh-button" onClick={onStart}>Commencer avec mon champ <ProductIcon name="arrow" size={18}/></button>
      <button className="fh-text-button" onClick={onReferences}>Voir les références agricoles <ProductIcon name="arrow" size={16}/></button>
     </div>
     <p className="fh-result-note"><ProductIcon name="chart" size={17}/>Les rendements et productions apparaissent seulement lorsqu’un calcul et les données nécessaires sont disponibles. Une estimation n’est pas une garantie de récolte.</p>
     <div className="fh-coverage-line" aria-label="Pays couverts">Togo <i/> Bénin <i/> Burkina Faso <i/> Ghana <i/> Côte d’Ivoire <i/> Sénégal</div>
    </div>

    <figure className="fh-satellite">
     <img src={'/images/senegal-landsat-'+year+'.webp'} alt={'Image satellite illustrative des cultures irriguées de la vallée du fleuve Sénégal en '+year+', végétation en rouge et eau en bleu'} width="1000" height="878" fetchPriority="high"/>
     <div className="fh-image-top"><span><ProductIcon name="satellite" size={17}/> Observer le paysage</span><span>Illustration satellite</span></div>
     <div className="fh-satellite-bottom">
      <div><span>Vallée du fleuve Sénégal · USGS / Landsat {year==='2023'?'9':'5'}</span><strong>{year==='2023'?'22 janvier 2023':'13 novembre 2011'}</strong><small>Cette vue ne représente pas votre parcelle.</small></div>
      <div className="fh-year-switch" aria-label="Choisir la date de l’image illustrative">{(['2011','2023'] as const).map(y=><button type="button" key={y} aria-pressed={year===y} onClick={()=>setYear(y)}>{y}</button>)}</div>
     </div>
     <figcaption><span><i className="fh-veg"/> Végétation en rouge</span><span><i className="fh-water"/> Eau en bleu</span><a href="https://eros.usgs.gov/earthshots/irrigation-along-the-senegal" target="_blank" rel="noreferrer">Source USGS ↗</a></figcaption>
    </figure>
   </section>

   <section className="fh-start" id="parcours" aria-labelledby="journey-title">
    <div className="fh-section-heading"><div><span className="fh-kicker">POUR COMMENCER</span><h2 id="journey-title">Trois étapes, du champ aux résultats.</h2></div><p>Faites une étape à la fois. Vous pourrez ouvrir les détails et les réglages au moment utile.</p></div>
    <ol className="fh-steps">{steps.map(step=><li key={step.number}><div className="fh-step-top"><span>{step.number}</span><ProductIcon name={step.icon} size={22}/></div><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    <div className="fh-next-step"><div><strong>Prêt à commencer ?</strong><span>La première étape : choisir votre champ.</span></div><button className="fh-button" onClick={onStart}>Commencer <ProductIcon name="arrow" size={18}/></button></div>
   </section>

   <section className="fh-tools" id="outils" aria-labelledby="tools-title">
    <div className="fh-section-heading fh-tools-heading"><div><span className="fh-kicker">DANS VOTRE ESPACE AGRICOLE</span><h2 id="tools-title">Les informations utiles à la saison.</h2></div><p>Les cartes et indicateurs apparaissent selon les données réellement disponibles pour la parcelle et la culture.</p></div>
    <div className="fh-feature-grid">{features.map(item=><article key={item.title}><span className="fh-feature-icon"><ProductIcon name={item.icon} size={22}/></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
   </section>

   <section className="fh-countries" id="pays" aria-label="Pays couverts par AgriPrévision"><div><span className="fh-kicker">COUVERTURE RÉGIONALE</span><h2>Six pays d’Afrique de l’Ouest.</h2></div><ul>{countries.map(country=><li key={country}><ProductIcon name="check" size={15}/>{country}</li>)}</ul><p>Les données, cultures et méthodes disponibles peuvent varier selon le pays et la campagne.</p></section>
  </main>

  <footer className="fh-footer"><ProductBrand onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}/><p>Observer le terrain. Préparer la saison. Suivre la récolte.</p><details><summary>Source et limites de l’image</summary><p>Vallée du fleuve Sénégal — USGS / EROS, images Landsat 5 (2011) et Landsat 9 (2023), domaine public. Cette image d’illustration n’est pas une observation de la parcelle choisie.</p><a href="https://eros.usgs.gov/earthshots/irrigation-along-the-senegal" target="_blank" rel="noreferrer">Consulter la source USGS ↗</a></details></footer>
 </div>;
}
