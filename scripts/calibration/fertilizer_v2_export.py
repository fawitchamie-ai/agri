"""Export only descriptive observations and failed validation status to the UI.

No model coefficients, callable predictor or private campaign information.
"""
from collections import defaultdict
import json
import statistics

from fertilizer_pipeline import COUNTRIES, digest, quantile, write
from fertilizer_v2_import import ROOT, BASE, DOC


def build(pairs, report):
    groups=defaultdict(list)
    for r in pairs:
        if r['country'] not in COUNTRIES:continue
        key=(r['source'],r['country'],r['site'],r['system'],tuple(r['treatedNutrients']),
             r['season'] if r['source']=='GFWCYQ' else 'all')
        groups[key].append(r)
    observations=[]
    for key,rr in sorted(groups.items()):
        r=rr[0];p=r['source']=='AMAZXA'
        observations.append(dict(id='|'.join(map(str,key)),sourceId=r['source'],country=COUNTRIES[r['country']],
            cropId='rice-flooded' if r['system']=='lowland' else 'rice-upland',
            location=r['location'],system=r['system'],pairs=len(rr),sites=1,
            campaigns=len({x['campaign'] for x in rr}),publications=1,
            season=r['season'] if not p else None,
            contrast='P_environment' if p else 'long_term_NPK_regime',
            baselineNutrients=r['baselineNutrients'],treatedNutrients=r['treatedNutrients'],
            moisturePercent=r['moisturePercent'],years=sorted({x['year'] for x in rr}),
            controlMedianTonnesHa=statistics.median(x['controlKgHa']/1000 for x in rr),
            treatedMedianTonnesHa=statistics.median(x['treatedKgHa']/1000 for x in rr),
            deltaMedianTonnesHa=statistics.median(x['deltaKgHa']/1000 for x in rr),
            deltaObserved80=[quantile([x['deltaKgHa']/1000 for x in rr],q) for q in (.1,.9)],
            negativePairs=sum(x['deltaKgHa']<0 for x in rr),
            source='https://doi.org/'+r['publication'],license=r['license'],
            attribution='Vandamme et al. (2016), supplementary genotype means' if p else 'Kouadio et al. (2025), Ndiaye observed campaign means',
            limits=['Parcelles voisines avec/sans P ; affectation du P non qualifiée comme randomisée.',
                'N et K déjà présents dans les deux modalités ; ce témoin n’est pas sans engrais.',
                'Moyennes ajustées par génotype d’une même publication, pas des parcelles indépendantes.'] if p else
                ['Régimes répétés sur les mêmes parcelles depuis une expérience de longue durée, à un seul site.',
                 'Le contraste inclut l’historique de fertilisation et l’apport conjoint de P et K.',
                 'Riz Sahel 108 irrigué ; humidité du grain non qualifiée dans les données acquises.']))
    research=[]
    for country,code in COUNTRIES.items():
        for source in ('AMAZXA','GFWCYQ'):
            rr=[r for r in pairs if r['country']==country and r['source']==source]
            for system in sorted({r['system'] for r in rr}):
                if source=='AMAZXA':
                    result=report[source]['byTargetCountrySystem'][country+'|'+system]
                    m=result['metrics'];baseline_mae=result['baseline']['MAE']
                else:
                    m=report[source]['test'];baseline_mae=report[source]['baseline']['MAE']
                research.append(dict(country=code,cropId='rice-flooded' if system=='lowland' else 'rice-upland',
                    sourceId=source,metrics=m,baselineMAE=baseline_mae,
                    design='Pays entièrement exclu, sélection interne par site' if source=='AMAZXA' else 'Test temporel 2021–2022, un seul site répété',
                    interval95Available=False,productionEnabled=False))
    missing={
        'TGO':['Maïs TROYBD : identifiants de paires, doses et localisation à qualifier dans les originaux.'],
        'BEN':['Riz : seulement deux sites publiés, réponse du phosphore avec N/K déjà apportés.','Maïs TROYBD : appariement original non récupéré.'],
        'BFA':['Riz : un site de phosphore ; RiceAdvice modifie aussi la conduite et ses unités P/K restent ambiguës.'],
        'GHA':['Maïs TROYBD : identifiants originaux manquants.','Riz RiceAdvice : identifiants d’exploitation absents et unités P/K à confirmer.'],
        'CIV':['Maïs TROYBD : identifiants originaux manquants.','Riz RiceAdvice : conduite, appariement et unités P/K non qualifiés.'],
        'SEN':['Riz : un seul site de longue durée, humidité non qualifiée.','Autres bases : doublons d’expérience, doses ou changements de variété à résoudre.']}
    return dict(version='fertilizer-extension-evidence-1',availableOn='2026-11-02',productionEnabled=False,
        observations=observations,research=research,missingByCountry=missing,
        limits=['Ces comparaisons publiées ne prédisent pas le rendement de votre champ.',
            'Dispersion observée (10e–90e percentiles), sans intervalle prédictif à 95 % disponible.',
            'Aucun gain n’est ajouté au rendement hydrique ni à la moyenne nationale. Aucune dose optimale déduite.',
            'Les six pays disposent d’un état des preuves ; aucun ne dispose ici d’une nouvelle réponse parcellaire validée.'])


if __name__=='__main__':
    pairs=json.loads((BASE/'pairs.json').read_text());report=json.loads((DOC/'VALIDATION.json').read_text())
    if report['productionEnabled'] or report['pairsSha256']!=digest(pairs):
        raise ValueError('Unqualified export input')
    result=build(pairs,report);write(ROOT/'data/seasonal/fertilizer-extension.json',result)
    print(json.dumps(dict(observations=len(result['observations']),researchDomains=len(result['research']))))
