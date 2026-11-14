# Portail Géodata Togo — utilité pour AgriPrévision

Vérification des fiches Géodata et du CSV « Coopératives - Agricoles » transmis pour examen, le 14 novembre 2026.

## Conclusions rapides

Le portail peut aider à mieux **localiser les champs, préciser leur contexte et préparer une collecte agronomique**. Les fichiers repérés ne fournissent pas encore le couple nécessaire à une calibration de rendement : une parcelle reliée à sa récolte mesurée en kg/ha.

| Source | Contenu utile repéré | Ce qu’elle ne fournit pas pour la calibration |
|---|---|---|
| CSV de coopératives transmis | 6 859 entités ponctuelles, réparties dans les cinq régions; attributs : région/préfecture/commune/canton, localité, nom/type/statut de coopérative et point géographique. 4 850 noms de coopératives distincts dans le fichier. | Pas de contour de champ, culture, superficie cultivée, date de semis, intervention, échantillon de sol ou rendement. Le point localise une entité, pas ses parcelles. |
| Géodata — « ZAAPs et ZAPBs - Champs individuels » | Géométries de champ `MultiPolygon`; attributs de localisation, surface déclarée, cultures de saison, eau/irrigation, engrais et semences. Peut servir à délimiter un cadre d’échantillonnage ou à vérifier classification de culture et séries Sentinel‑2 dans les ZAAP concernées. | La fiche ne décrit pas de masse récoltée ni de rendement mesuré. `production_saison` renseigne la saison de production (ex. saison des pluies), pas une production en kg; aucune cible t/ha n’est visible dans son dictionnaire. Couverture limitée aux ZAAP/ZAPB. |
| Géodata — coopératives, ZAAP, barrages et infrastructures agricoles | Contexte d’accès aux organisations, zones d’activité agricole et ressources hydrauliques. Peut aider à planifier les services et échantillons. | La proximité d’une coopérative, d’un barrage ou d’un point d’eau ne prouve ni la limite d’un champ, ni l’accès réel à l’eau, ni son utilisation. |
| FertiTogo / système d’information sur les sols | Cartes locales pH, matière organique, phosphore assimilable, potassium échangeable et, selon la zone, conductivité électrique; méthodes de laboratoire documentées par l’ITRA. Plus local que SoilGrids pour le statut de fertilité au Togo. | La couverture varie par région et certaines cartes sont des zones pilotes; la version consultée propose des cartes PDF, pas un service raster/vectoriel machine-readable confirmé. Ce ne sont pas des rendements ni des mesures contemporaines de disponibilité N/P/K dans chaque parcelle. |

Le site Géodata explique que ses couches décrivent des infrastructures et indicateurs du Togo, recueillis en 2022 avec actualisation ministérielle. Son catalogue comprend notamment l’agriculture, l’eau, la foresterie et les transports. Ces couches sont donc très utiles pour des cartes et pour le ciblage d’observations, même lorsqu’elles ne sont pas des étiquettes de rendement.

## Utilisation scientifique envisageable

1. Demander le fichier vectoriel **des champs individuels ZAAP/ZAPB**, avec dates, règles de mesure des surfaces et documentation de la culture déclarée. Croiser ces géométries avec les profils Sentinel‑2 pour tester masque de champ, calendrier et classification culturale. Ne jamais traiter la coopérative ou le polygone ZAAP comme un rendement de maïs sans mesure de culture et de récolte au champ.
2. Demander à l’ITRA les valeurs numériques géoréférencées de FertiTogo (points d’échantillonnage ou grilles originales), dates, profondeur, unités, incertitudes, densité des prélèvements, méthode et conditions d’accès. Les PDF/cartes de classes peuvent soutenir un diagnostic régional; ils ne doivent pas être numérisés à l’écran puis présentés comme des analyses de parcelle.
3. Lorsqu’une récolte est disponible, enregistrer au même identifiant de champ : culture/variété, dates, surface nette récoltée, masse de grain, humidité, apports et météo. C’est l’appariement qui transformerait le portail en source d’entraînement ou de validation de rendement.
4. Les champs nominatifs, contacts et identifiants de personnes présents dans certaines fiches ne sont pas nécessaires aux modèles. Les exclure des exports et obtenir les autorisations/consentements appropriés avant toute collecte ou mise en relation.

## Conditions de réutilisation

Les CGU publiques Géodata distinguent consultation/téléchargement gratuits et réutilisation assujettie à une contrepartie financière. Elles requièrent une demande individuelle pour certains contenus, l’attribution avec la date de mise à jour, et interdisent de dénaturer les données. Le coût et la licence de la couche exacte doivent donc être vérifiés avant incorporation à AgriPrévision ou republication. La possibilité de télécharger un fichier ne signifie pas à elle seule que son intégration dans une application est gratuite.

Les droits de réutilisation de FertiTogo doivent aussi être confirmés avec l’ITRA avant de copier les cartes, d’en dériver un raster ou de les embarquer dans un produit.

## Sources

- [Géodata Togo — accueil et catégories](https://geodata.gouv.tg/)
- [Géodata — ZAAP/ZAPB, champs individuels et dictionnaire](https://geodata.gouv.tg/donnees/0f7ba53a-8786-476a-86d1-bfd7b43e4465)
- [Géodata — informations juridiques et CGU](https://geodata.gouv.tg/informations-juridiques)
- [FertiTogo — cartes de fertilité](https://fertitogo.tg/cartes-de-fertilite)
- [FertiTogo — méthodes d’analyse des sols](https://fertitogo.tg/analyse-des-sols)
- [Ministère de l’Agriculture — état du système d’information sur les sols, 24 juin 2025](https://agriculture.gouv.tg/le-systeme-dinformation-sur-les-sol-du-togo-un-outil-cle-pour-la-gestion-durable-des-ressources/)
