'use client';

import {useState, type FormEvent} from 'react';
import {isoDate} from '../../lib/seasonal/validation';
import {parseWaterStageCalendar, waterStageScope, type WaterStageCalendar} from '../../lib/seasonal/water-stages';
import type {SeasonalConfig} from '../../lib/seasonal/types';
import type {YieldReference} from '../../lib/seasonal/yield';

export const WATER_YIELD_MODELS = {
  'fao-seasonal': 'FAO-56 · Cycle entier',
  'fao-stages': 'FAO-33 · Phases du maïs',
} as const;
export type WaterYieldMethod = keyof typeof WATER_YIELD_MODELS;

type Props = {
  config: SeasonalConfig;
  method: WaterYieldMethod;
  reference?: YieldReference | null;
  calendar?: WaterStageCalendar;
  onApply: (reference: YieldReference, calendar?: WaterStageCalendar) => void;
};

export default function WaterYieldModelForm({config, method, reference, calendar, onApply}: Props) {
  const [error, setError] = useState('');
  const staged = method === 'fao-stages';
  const cycleDays = config.stages.reduce((days, stage) => days + stage.days, 0);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? '').trim();
    try {
      const kgHa = Number(field('yield')) * 1000;
      const source = field('source'), context = field('context');
      if (!field('yield') || !Number.isFinite(kgHa) || kgHa <= 0 || kgHa > 1e6 || !source || !context || !form.has('independent')) {
        throw new Error('Renseignez un rendement de référence positif, sa source et son contexte, puis confirmez l’absence de déficit hydrique.');
      }
      if (!config.cropProfile) throw new Error('Choisissez d’abord la culture de la campagne.');
      const availableOn = isoDate(field('availableOn'));
      if (availableOn > config.asOfDate) throw new Error('La référence doit être disponible à la date d’analyse.');
      const moisture = field('moisture');
      const moisturePercent = Number(moisture);
      if (moisture && (!Number.isFinite(moisturePercent) || moisturePercent < 0 || moisturePercent >= 100)) {
        throw new Error('L’humidité du grain doit être comprise entre 0 et moins de 100 %.');
      }
      const responseCalendar = staged ? parseWaterStageCalendar({
        version: 'maize-water-stages-1',
        acceptedHypothesis: form.has('acceptedPhases'),
        scope: waterStageScope(config),
        source: field('calendarSource'),
        availableOn: field('calendarDate'),
        establishmentEndDay: Number(field('establishmentEndDay')),
        floweringStartDay: Number(field('floweringStartDay')),
        floweringDays: Number(field('floweringDays')),
        grainEndDay: Number(field('grainEndDay')),
      }, config) : undefined;
      setError('');
      onApply({kind: 'attainable', kgHa, source, context, cropId: config.cropProfile.id, availableOn,
        denominator: 'sown', independentYm: true, ...(moisture ? {moisturePercent} : {})}, responseCalendar);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Paramètres de simulation invalides.');
    }
  }

  return <form onSubmit={apply} className="water-yield-model-form">
    <h4>{WATER_YIELD_MODELS[method]}</h4>
    <p>Ce modèle expérimental utilise le bilan d’eau et une référence documentée pour votre culture. Il n’a pas encore été validé pour votre parcelle.</p>
    <div className="form-grid">
      <label className="field"><span>Référence indépendante sans déficit d’eau (t/ha)</span><input name="yield" type="number" required min="0" max="1000" step="any" defaultValue={reference ? reference.kgHa / 1000 : ''}/></label>
      <label className="field"><span>Source de la référence</span><input name="source" required maxLength={1200} defaultValue={reference?.source}/></label>
      <label className="field"><span>Culture, variété et conduite concernées</span><input name="context" required maxLength={1200} defaultValue={reference?.context}/></label>
      <label className="field"><span>Référence disponible depuis</span><input name="availableOn" type="date" required max={config.asOfDate} defaultValue={reference?.availableOn}/></label>
      <label className="field"><span>Humidité du grain (%) · si connue</span><input name="moisture" type="number" min="0" max="99.99" step="any" defaultValue={reference?.moisturePercent}/></label>
    </div>
    <label className="field"><span><input name="independent" type="checkbox" required defaultChecked={reference?.independentYm}/> Je confirme que cette référence est exprimée par hectare semé et correspond à des conditions sans déficit d’eau.</span></label>
    {staged && <fieldset>
      <legend>Calendrier des phases du maïs</legend>
      <p>Comptez le semis comme jour 1. Les phases doivent se succéder dans le cycle de {cycleDays} jours. Indiquez la source du calendrier utilisé.</p>
      <div className="form-grid">
        <label className="field"><span>Dernier jour d’installation</span><input name="establishmentEndDay" type="number" required min="1" max={cycleDays} defaultValue={calendar?.establishmentEndDay}/></label>
        <label className="field"><span>Premier jour de floraison</span><input name="floweringStartDay" type="number" required min="1" max={cycleDays} defaultValue={calendar?.floweringStartDay}/></label>
        <label className="field"><span>Durée de la floraison (jours)</span><input name="floweringDays" type="number" required min="1" max={cycleDays} defaultValue={calendar?.floweringDays}/></label>
        <label className="field"><span>Dernier jour de formation du grain</span><input name="grainEndDay" type="number" required min="1" max={cycleDays} defaultValue={calendar?.grainEndDay}/></label>
        <label className="field"><span>Source du calendrier</span><input name="calendarSource" required maxLength={1600} defaultValue={calendar?.source}/></label>
        <label className="field"><span>Calendrier disponible depuis</span><input name="calendarDate" type="date" required max={config.asOfDate} defaultValue={calendar?.availableOn}/></label>
      </div>
      <label className="field"><span><input name="acceptedPhases" type="checkbox" required defaultChecked={calendar?.acceptedHypothesis}/> J’accepte l’hypothèse expérimentale de réponse à l’eau par phase.</span></label>
    </fieldset>}
    <div className="form-actions"><button type="submit" className="btn primary">Appliquer le modèle et recalculer</button></div>
    {error && <p role="alert">{error}</p>}
  </form>;
}
