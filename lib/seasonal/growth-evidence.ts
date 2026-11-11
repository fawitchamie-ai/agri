import type {Country} from './types.ts';

/** Acquired experimental evidence in this repository; not a national-coverage claim. */
export const GROWTH_EVIDENCE:Record<Country,{biomass:string;canopy:string;scope:string;source:string}>={
 TGO:{biomass:'Moyennes publiées par stade et traitement',canopy:'Couvert et LAI publiés par stade',scope:'Un essai et trois traitements ; pas de mesures quotidiennes répliquées disponibles ici. Développement et diagnostic seulement.',source:'Dapaong, DOI 10.17159/wsa/2020.v46.i1.7894'},
 GHA:{biomass:'Biomasse de quadrat présente dans une partie des lignes acquises',canopy:'LAI mesuré sur des visites de champs',scope:'144 lignes de quadrat, avec biomasse partielle, et 500 mesures biophysiques ; données de 2021, dates de semis et conduite incomplètes. Nowcast déjà exploré, pas de validation multi-saison.',source:'Northern Ghana, DOI 10.5281/zenodo.6632083'},
 BEN:{biomass:'Aucune série expérimentale acquise dans ce dépôt',canopy:'Aucune série expérimentale acquise dans ce dépôt',scope:'Les rendements historiques ne remplacent pas des mesures de biomasse/couvert.',source:'Inventaire des fichiers de recherche acquis au 2026-11-11'},
 BFA:{biomass:'Aucune série expérimentale acquise dans ce dépôt',canopy:'Aucune série expérimentale acquise dans ce dépôt',scope:'Les rendements historiques ne remplacent pas des mesures de biomasse/couvert.',source:'Inventaire des fichiers de recherche acquis au 2026-11-11'},
 CIV:{biomass:'Aucune série expérimentale acquise dans ce dépôt',canopy:'Aucune série expérimentale acquise dans ce dépôt',scope:'Les rendements historiques ne remplacent pas des mesures de biomasse/couvert.',source:'Inventaire des fichiers de recherche acquis au 2026-11-11'},
 SEN:{biomass:'Aucune série expérimentale acquise dans ce dépôt',canopy:'Aucune série expérimentale acquise dans ce dépôt',scope:'Les rendements historiques ne remplacent pas des mesures de biomasse/couvert.',source:'Inventaire des fichiers de recherche acquis au 2026-11-11'},
};
