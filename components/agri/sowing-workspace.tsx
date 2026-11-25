'use client';
import { HelpParagraph } from './help-dialog';
import type {ReactNode} from 'react';
import type {SeasonalConfig,WaterEvent} from '../../lib/seasonal/types';
import SowingComparison from './sowing-comparison';
export default function SowingWorkspace({config,events,onBack,onSowingDateChange,onCheckSoil,children}:{config:SeasonalConfig;events:WaterEvent[];onBack:()=>void;onSowingDateChange?:(date:string)=>void;onCheckSoil?:()=>void;children:ReactNode}){
 return <><section className="card"><span className="product-eyebrow">DÉCISION · SEMIS</span><h2>Quand semer ?</h2><HelpParagraph>Comparez les dates et vérifiez les conditions locales avant de modifier le calendrier.</HelpParagraph>
  <div className="form-actions"><button className="btn primary" onClick={onBack}>Continuer ma simulation</button></div>
  <HelpParagraph><strong>Pour régler l’eau :</strong> ouvrez « Eau et semis », puis « Modifier mes apports prévus ».</HelpParagraph>
  <HelpParagraph><strong>Pour les engrais :</strong> ouvrez « Engrais », renseignez le produit, sa dose et sa date, puis consultez « Effet sur le rendement ». Le calcul exploratoire NPK concerne le maïs ; les autres effets restent indiqués lorsqu’ils ne sont pas calculables.</HelpParagraph>
 </section><SowingComparison config={config} events={events} onSowingDateChange={onSowingDateChange} onCheckSoil={onCheckSoil}/>
 <details className="card"><summary>Outils techniques facultatifs — avec un conseiller</summary><HelpParagraph>Ces outils servent à vérifier une référence ou un plan déjà établi. Ils ne sont pas nécessaires pour comparer les dates ni pour régler vos apports. Ne remplissez pas les besoins NPK au hasard.</HelpParagraph>{children}</details></>;
}
