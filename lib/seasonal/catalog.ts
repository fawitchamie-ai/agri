/** Factual reference catalog, researched 2026-10-29. Not local prescriptions.
 * All ranges retain their source scope; null is an acquisition gap. */
import type { SeasonalConfig, Stage } from './types.ts';
export const CATALOG_VERSION = 'agronomy-2026-10-29.1';
export type CropProfile = {
 id:string; name:string; scientificName:string; group:string; notes:string[]; nutrition:string;
 ecology:null|{phOptimal:number[]|null;phAbsolute:number[]|null;temperatureOptimalC:number[]|null;annualRainOptimalMm:number[]|null;sourceId:string};
 water:null|{kc:number[];rootRangeM:number[];pAtEtc5:number;stageExampleDays:number[];stageExampleContext:string;durationIssue:string|null;sourceIds:string[];automaticExample:boolean};
 eceThresholdDsM:number[]|null; missing:string[];
};
export const CROPS: CropProfile[] = [
  {
    "id": "maize",
    "name": "Maïs",
    "scientificName": "Zea mays",
    "group": "Céréales",
    "notes": [
      "Grain sec ; floraison et formation du grain à surveiller."
    ],
    "nutrition": "N, P, K ; fractionnement de N selon référence locale. Diagnostic Zn possible, sans apport automatique.",
    "ecology": {
      "phOptimal": [
        5.0,
        7.0
      ],
      "phAbsolute": [
        4.5,
        8.5
      ],
      "temperatureOptimalC": [
        18.0,
        33.0
      ],
      "annualRainOptimalMm": [
        600.0,
        1200.0
      ],
      "sourceId": "ecocrop-maize"
    },
    "water": {
      "kc": [
        0.3,
        1.2,
        0.35
      ],
      "rootRangeM": [
        1,
        1.7
      ],
      "pAtEtc5": 0.55,
      "stageExampleDays": [
        20,
        35,
        40,
        30
      ],
      "stageExampleContext": "Nigeria, climat humide, mai",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      1.7,
      1.7
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "sorghum",
    "name": "Sorgho grain",
    "scientificName": "Sorghum bicolor",
    "group": "Céréales",
    "notes": [
      "Grain ; sensibilité variétale à la photopériode."
    ],
    "nutrition": "N, P, K ; matière organique, eau disponible et risque de verse à considérer.",
    "ecology": {
      "phOptimal": [
        5.5,
        7.5
      ],
      "phAbsolute": [
        5.0,
        8.0
      ],
      "temperatureOptimalC": [
        22.0,
        35.0
      ],
      "annualRainOptimalMm": [
        400.0,
        600.0
      ],
      "sourceId": "ecocrop-sorghum"
    },
    "water": {
      "kc": [
        0.3,
        1.05,
        0.55
      ],
      "rootRangeM": [
        1,
        2
      ],
      "pAtEtc5": 0.55,
      "stageExampleDays": [
        20,
        35,
        40,
        30
      ],
      "stageExampleContext": "Arides, juin/juillet",
      "durationIssue": "Tableau 11 : total imprimé 130, somme des phases 125. Durées à confirmer ; aucune application automatique.",
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": false
    },
    "eceThresholdDsM": [
      6.8,
      6.8
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Tableau 11 : total imprimé 130, somme des phases 125. Durées à confirmer ; aucune application automatique."
    ]
  },
  {
    "id": "millet",
    "name": "Mil perlé",
    "scientificName": "Cenchrus americanus (syn. Pennisetum glaucum)",
    "group": "Céréales",
    "notes": [
      "Grain ; variété et saison sahélienne à préciser."
    ],
    "nutrition": "N, P, K ; accès au phosphore et microdose uniquement selon protocole local.",
    "ecology": {
      "phOptimal": [
        5.0,
        6.5
      ],
      "phAbsolute": [
        4.5,
        8.3
      ],
      "temperatureOptimalC": [
        25.0,
        35.0
      ],
      "annualRainOptimalMm": [
        400.0,
        900.0
      ],
      "sourceId": "ecocrop-millet"
    },
    "water": {
      "kc": [
        0.3,
        1,
        0.3
      ],
      "rootRangeM": [
        1,
        2
      ],
      "pAtEtc5": 0.55,
      "stageExampleDays": [
        15,
        25,
        40,
        25
      ],
      "stageExampleContext": "Pakistan, juin",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "rice-upland",
    "name": "Riz pluvial",
    "scientificName": "Oryza sativa",
    "group": "Céréales",
    "notes": [
      "Riz sans submersion. Les coefficients du riz submergé ne sont pas transférés."
    ],
    "nutrition": "N, P, K ; azote fractionné, fer et zinc selon diagnostic et régime hydrique.",
    "ecology": null,
    "water": null,
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Kc, profondeur racinaire, fraction p et durées de stades adaptés à acquérir ; aucun calendrier chiffré automatique."
    ]
  },
  {
    "id": "rice-flooded",
    "name": "Riz submergé",
    "scientificName": "Oryza sativa",
    "group": "Céréales",
    "notes": [
      "Rizière : lame de submersion, infiltration et percolation exigent un autre bilan."
    ],
    "nutrition": "N, P, K ; volatilisation et redox du sol spécifiques au riz submergé.",
    "ecology": {
      "phOptimal": [
        5.5,
        7.0
      ],
      "phAbsolute": [
        4.5,
        9.0
      ],
      "temperatureOptimalC": [
        20.0,
        30.0
      ],
      "annualRainOptimalMm": [
        1500.0,
        2000.0
      ],
      "sourceId": "ecocrop-rice"
    },
    "water": {
      "kc": [
        1.05,
        1.2,
        0.6
      ],
      "rootRangeM": [
        0.5,
        1
      ],
      "pAtEtc5": 0.2,
      "stageExampleDays": [
        30,
        30,
        60,
        30
      ],
      "stageExampleContext": "Tropiques, riz submergé",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": false
    },
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Bilan de rizière submergée non implémenté : calcul générique bloqué."
    ]
  },
  {
    "id": "cowpea",
    "name": "Niébé",
    "scientificName": "Vigna unguiculata",
    "group": "Légumineuses",
    "notes": [
      "Grain sec ; floraison et remplissage des gousses à suivre."
    ],
    "nutrition": "Nodulation et fixation symbiotique ; P, K et S selon analyse. Aucun forfait azoté du maïs.",
    "ecology": {
      "phOptimal": [
        5.5,
        7.5
      ],
      "phAbsolute": [
        4.0,
        8.8
      ],
      "temperatureOptimalC": [
        25.0,
        35.0
      ],
      "annualRainOptimalMm": [
        500.0,
        1500.0
      ],
      "sourceId": "ecocrop-cowpea"
    },
    "water": {
      "kc": [
        0.4,
        1.05,
        0.35
      ],
      "rootRangeM": [
        0.6,
        1
      ],
      "pAtEtc5": 0.45,
      "stageExampleDays": [
        20,
        30,
        30,
        20
      ],
      "stageExampleContext": "Arides, mars",
      "durationIssue": "Tableau 11 : total imprimé 110, somme des phases 100. Durées à confirmer ; aucune application automatique.",
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": false
    },
    "eceThresholdDsM": [
      4.9,
      4.9
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Tableau 11 : total imprimé 110, somme des phases 100. Durées à confirmer ; aucune application automatique."
    ]
  },
  {
    "id": "soybean",
    "name": "Soja",
    "scientificName": "Glycine max",
    "group": "Légumineuses",
    "notes": [
      "Grain ; photopériode, inoculation et variété à préciser."
    ],
    "nutrition": "Nodulation, inoculant compatible et P/K ; fixation de N non chiffrée sans données locales.",
    "ecology": {
      "phOptimal": [
        5.5,
        6.5
      ],
      "phAbsolute": [
        4.5,
        8.4
      ],
      "temperatureOptimalC": [
        20.0,
        33.0
      ],
      "annualRainOptimalMm": [
        600.0,
        1500.0
      ],
      "sourceId": "ecocrop-soybean"
    },
    "water": {
      "kc": [
        0.4,
        1.15,
        0.5
      ],
      "rootRangeM": [
        0.6,
        1.3
      ],
      "pAtEtc5": 0.5,
      "stageExampleDays": [
        15,
        15,
        40,
        15
      ],
      "stageExampleContext": "Tropiques, décembre",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      5,
      5
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "groundnut",
    "name": "Arachide",
    "scientificName": "Arachis hypogaea",
    "group": "Légumineuses",
    "notes": [
      "Gousses ; sol meuble, drainage et humidité de la zone de fructification."
    ],
    "nutrition": "P/K et calcium dans la zone des gousses ; vérifier pH et nodulation avant apport.",
    "ecology": {
      "phOptimal": [
        5.5,
        6.5
      ],
      "phAbsolute": [
        4.5,
        8.5
      ],
      "temperatureOptimalC": [
        22.0,
        32.0
      ],
      "annualRainOptimalMm": [
        600.0,
        1500.0
      ],
      "sourceId": "ecocrop-groundnut"
    },
    "water": {
      "kc": [
        0.4,
        1.15,
        0.6
      ],
      "rootRangeM": [
        0.5,
        1
      ],
      "pAtEtc5": 0.5,
      "stageExampleDays": [
        25,
        35,
        45,
        25
      ],
      "stageExampleContext": "Afrique de l’Ouest, saison sèche",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      3.2,
      3.2
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "bambara",
    "name": "Voandzou",
    "scientificName": "Vigna subterranea",
    "group": "Légumineuses",
    "notes": [
      "Légumineuse à gousses souterraines ; option de diversification."
    ],
    "nutrition": "Nodulation, P/K ; aucune dose spécifique qualifiée acquise pour les six pays.",
    "ecology": {
      "phOptimal": [
        5.0,
        6.5
      ],
      "phAbsolute": [
        4.3,
        7.0
      ],
      "temperatureOptimalC": [
        19.0,
        30.0
      ],
      "annualRainOptimalMm": [
        750.0,
        1400.0
      ],
      "sourceId": "ecocrop-bambara"
    },
    "water": null,
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Kc, profondeur racinaire, fraction p et durées de stades adaptés à acquérir ; aucun calendrier chiffré automatique."
    ]
  },
  {
    "id": "cassava",
    "name": "Manioc — première année",
    "scientificName": "Manihot esculenta",
    "group": "Racines et tubercules",
    "notes": [
      "Référence hydrique de première année ; les cycles longs dépassant 366 jours exigent une extension."
    ],
    "nutrition": "Exportations de K, restitution des résidus et diagnostic P/N. Une fiche de production de boutures ne vaut pas pour les racines alimentaires.",
    "ecology": {
      "phOptimal": [
        5.5,
        8.0
      ],
      "phAbsolute": [
        4.0,
        9.0
      ],
      "temperatureOptimalC": [
        20.0,
        29.0
      ],
      "annualRainOptimalMm": [
        1000.0,
        1500.0
      ],
      "sourceId": "ecocrop-cassava"
    },
    "water": {
      "kc": [
        0.3,
        0.8,
        0.3
      ],
      "rootRangeM": [
        0.5,
        0.8
      ],
      "pAtEtc5": 0.35,
      "stageExampleDays": [
        20,
        40,
        90,
        60
      ],
      "stageExampleContext": "Tropiques, première année, plantation en saison humide",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "sweet-potato",
    "name": "Patate douce",
    "scientificName": "Ipomoea batatas",
    "group": "Racines et tubercules",
    "notes": [
      "Tubercules ; initiation et grossissement, drainage."
    ],
    "nutrition": "Équilibre N/K ; excès de N susceptible de favoriser le feuillage. Dose locale à établir.",
    "ecology": {
      "phOptimal": [
        5.0,
        7.0
      ],
      "phAbsolute": [
        4.0,
        8.7
      ],
      "temperatureOptimalC": [
        18.0,
        28.0
      ],
      "annualRainOptimalMm": [
        750.0,
        2000.0
      ],
      "sourceId": "ecocrop-sweet-potato"
    },
    "water": {
      "kc": [
        0.5,
        1.15,
        0.65
      ],
      "rootRangeM": [
        1,
        1.5
      ],
      "pAtEtc5": 0.65,
      "stageExampleDays": [
        15,
        30,
        50,
        30
      ],
      "stageExampleContext": "Tropiques, saison humide",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      1.5,
      2.5
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "yam",
    "name": "Igname blanche",
    "scientificName": "Dioscorea rotundata",
    "group": "Racines et tubercules",
    "notes": [
      "Buttes, variété et âge de la parcelle ; ne pas mélanger toutes les espèces d’igname."
    ],
    "nutrition": "N, P, K ; précédent/jachère et restitution à considérer. Besoins distincts du manioc.",
    "ecology": {
      "phOptimal": [
        6.4,
        6.7
      ],
      "phAbsolute": [
        5.8,
        8.5
      ],
      "temperatureOptimalC": [
        25.0,
        32.0
      ],
      "annualRainOptimalMm": [
        1000.0,
        1500.0
      ],
      "sourceId": "ecocrop-yam"
    },
    "water": null,
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Kc, profondeur racinaire, fraction p et durées de stades adaptés à acquérir ; aucun calendrier chiffré automatique."
    ]
  },
  {
    "id": "onion",
    "name": "Oignon sec",
    "scientificName": "Allium cepa",
    "group": "Maraîchage",
    "notes": [
      "Bulbe de consommation ; cultivar adapté à la durée du jour. Pas de prescription universelle d’arrêt d’eau."
    ],
    "nutrition": "N/P/K et S ; modérer N tardif selon référence. Distinguer bulbes, pépinière et semences.",
    "ecology": {
      "phOptimal": [
        6.0,
        7.0
      ],
      "phAbsolute": [
        4.3,
        8.3
      ],
      "temperatureOptimalC": [
        12.0,
        25.0
      ],
      "annualRainOptimalMm": [
        350.0,
        600.0
      ],
      "sourceId": "ecocrop-onion"
    },
    "water": {
      "kc": [
        0.7,
        1.05,
        0.75
      ],
      "rootRangeM": [
        0.3,
        0.6
      ],
      "pAtEtc5": 0.3,
      "stageExampleDays": [
        15,
        25,
        70,
        40
      ],
      "stageExampleContext": "Méditerranée, avril",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      1.2,
      1.2
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "tomato",
    "name": "Tomate",
    "scientificName": "Solanum lycopersicum",
    "group": "Maraîchage",
    "notes": [
      "Fruit frais ; variété, repiquage, floraison et grossissement."
    ],
    "nutrition": "N/P/K, calcium et régularité de l’eau ; un symptôme ne suffit pas à conclure à une carence du sol.",
    "ecology": {
      "phOptimal": [
        5.5,
        6.8
      ],
      "phAbsolute": [
        5.0,
        7.5
      ],
      "temperatureOptimalC": [
        20.0,
        27.0
      ],
      "annualRainOptimalMm": [
        600.0,
        1300.0
      ],
      "sourceId": "ecocrop-tomato"
    },
    "water": {
      "kc": [
        0.6,
        1.15,
        0.8
      ],
      "rootRangeM": [
        0.7,
        1.5
      ],
      "pAtEtc5": 0.4,
      "stageExampleDays": [
        30,
        40,
        40,
        25
      ],
      "stageExampleContext": "Arides, janvier",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      0.9,
      2.5
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "okra",
    "name": "Gombo",
    "scientificName": "Abelmoschus esculentus",
    "group": "Maraîchage",
    "notes": [
      "Récoltes répétées ; cycles courts et longs distincts."
    ],
    "nutrition": "N/P/K ; doses à distinguer selon durée du cycle et contexte.",
    "ecology": {
      "phOptimal": [
        5.5,
        7.0
      ],
      "phAbsolute": [
        4.5,
        8.7
      ],
      "temperatureOptimalC": [
        20.0,
        30.0
      ],
      "annualRainOptimalMm": [
        600.0,
        1200.0
      ],
      "sourceId": "ecocrop-okra"
    },
    "water": null,
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Kc, profondeur racinaire, fraction p et durées de stades adaptés à acquérir ; aucun calendrier chiffré automatique."
    ]
  },
  {
    "id": "hot-pepper",
    "name": "Piment",
    "scientificName": "Capsicum frutescens",
    "group": "Maraîchage",
    "notes": [
      "Espèce à confirmer ; ne pas reprendre automatiquement le poivron Capsicum annuum."
    ],
    "nutrition": "N/P/K, calcium ; pépinière et plein champ ont des surfaces de référence différentes.",
    "ecology": null,
    "water": null,
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Kc, profondeur racinaire, fraction p et durées de stades adaptés à acquérir ; aucun calendrier chiffré automatique."
    ]
  },
  {
    "id": "bell-pepper",
    "name": "Poivron doux",
    "scientificName": "Capsicum annuum",
    "group": "Maraîchage",
    "notes": [
      "Fruit frais ; coefficients spécifiques au poivron."
    ],
    "nutrition": "N/P/K et calcium selon diagnostic ; éviter excès de sels et apports arbitraires d’oligoéléments.",
    "ecology": {
      "phOptimal": [
        5.5,
        6.8
      ],
      "phAbsolute": [
        4.5,
        7.0
      ],
      "temperatureOptimalC": [
        17.0,
        30.0
      ],
      "annualRainOptimalMm": [
        600.0,
        1250.0
      ],
      "sourceId": "ecocrop-bell-pepper"
    },
    "water": {
      "kc": [
        0.6,
        1.05,
        0.9
      ],
      "rootRangeM": [
        0.5,
        1
      ],
      "pAtEtc5": 0.3,
      "stageExampleDays": [
        30,
        40,
        110,
        30
      ],
      "stageExampleContext": "Arides, octobre",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      1.5,
      1.7
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "cabbage",
    "name": "Chou pommé",
    "scientificName": "Brassica oleracea var. capitata",
    "group": "Maraîchage",
    "notes": [
      "Pommes ; températures et variété adaptées à la saison."
    ],
    "nutrition": "N/P/K et S ; B/Mo seulement si diagnostic et référence locale justifient un apport.",
    "ecology": {
      "phOptimal": [
        6.0,
        7.5
      ],
      "phAbsolute": [
        5.0,
        8.3
      ],
      "temperatureOptimalC": [
        15.0,
        24.0
      ],
      "annualRainOptimalMm": [
        500.0,
        1000.0
      ],
      "sourceId": "ecocrop-cabbage"
    },
    "water": {
      "kc": [
        0.7,
        1.05,
        0.95
      ],
      "rootRangeM": [
        0.5,
        0.8
      ],
      "pAtEtc5": 0.45,
      "stageExampleDays": [
        40,
        60,
        50,
        15
      ],
      "stageExampleContext": "Californie, septembre",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      1,
      1.8
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "cucumber",
    "name": "Concombre frais",
    "scientificName": "Cucumis sativus",
    "group": "Maraîchage",
    "notes": [
      "Fruit frais ; ne pas confondre conduite industrielle et récoltes manuelles."
    ],
    "nutrition": "N/P/K, salinité et eau régulière ; teneurs exactes des produits à confirmer.",
    "ecology": {
      "phOptimal": [
        6.0,
        7.5
      ],
      "phAbsolute": [
        4.5,
        8.7
      ],
      "temperatureOptimalC": [
        18.0,
        32.0
      ],
      "annualRainOptimalMm": [
        1000.0,
        1200.0
      ],
      "sourceId": "ecocrop-cucumber"
    },
    "water": {
      "kc": [
        0.6,
        1,
        0.75
      ],
      "rootRangeM": [
        0.7,
        1.2
      ],
      "pAtEtc5": 0.5,
      "stageExampleDays": [
        20,
        30,
        40,
        15
      ],
      "stageExampleContext": "Arides, juin/août",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": [
      1.1,
      2.5
    ],
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "watermelon",
    "name": "Pastèque",
    "scientificName": "Citrullus lanatus",
    "group": "Maraîchage",
    "notes": [
      "Fruit ; pollinisation et grossissement à surveiller."
    ],
    "nutrition": "N/P/K ; qualité du fruit et salinité à suivre, sans dose nationale universelle.",
    "ecology": {
      "phOptimal": [
        6.0,
        7.0
      ],
      "phAbsolute": [
        5.5,
        7.5
      ],
      "temperatureOptimalC": [
        20.0,
        35.0
      ],
      "annualRainOptimalMm": [
        500.0,
        700.0
      ],
      "sourceId": "ecocrop-watermelon"
    },
    "water": {
      "kc": [
        0.4,
        1,
        0.75
      ],
      "rootRangeM": [
        0.8,
        1.5
      ],
      "pAtEtc5": 0.4,
      "stageExampleDays": [
        20,
        30,
        30,
        30
      ],
      "stageExampleContext": "Italie, avril",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "eggplant",
    "name": "Aubergine — S. melongena",
    "scientificName": "Solanum melongena",
    "group": "Maraîchage",
    "notes": [
      "Ne couvre pas automatiquement les aubergines africaines S. aethiopicum/S. macrocarpon."
    ],
    "nutrition": "N/P/K et calcium ; diagnostic et rythme de récolte nécessaires.",
    "ecology": {
      "phOptimal": [
        5.5,
        6.8
      ],
      "phAbsolute": [
        4.3,
        8.5
      ],
      "temperatureOptimalC": [
        20.0,
        35.0
      ],
      "annualRainOptimalMm": [
        1200.0,
        1600.0
      ],
      "sourceId": "ecocrop-eggplant"
    },
    "water": {
      "kc": [
        0.6,
        1.05,
        0.9
      ],
      "rootRangeM": [
        0.7,
        1.2
      ],
      "pAtEtc5": 0.45,
      "stageExampleDays": [
        30,
        40,
        40,
        20
      ],
      "stageExampleContext": "Arides, octobre",
      "durationIssue": null,
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": true
    },
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée."
    ]
  },
  {
    "id": "sesame",
    "name": "Sésame",
    "scientificName": "Sesamum indicum",
    "group": "Oléagineux",
    "notes": [
      "Diversification ; sol drainé et variété adaptée."
    ],
    "nutrition": "N/P/K et S selon analyse ; éviter forte dose azotée sans référence locale.",
    "ecology": {
      "phOptimal": [
        5.5,
        7.5
      ],
      "phAbsolute": [
        4.5,
        8.0
      ],
      "temperatureOptimalC": [
        20.0,
        30.0
      ],
      "annualRainOptimalMm": [
        500.0,
        1000.0
      ],
      "sourceId": "ecocrop-sesame"
    },
    "water": {
      "kc": [
        0.35,
        1.1,
        0.25
      ],
      "rootRangeM": [
        1,
        1.5
      ],
      "pAtEtc5": 0.6,
      "stageExampleDays": [
        20,
        30,
        40,
        20
      ],
      "stageExampleContext": "Venezuela, mai/juin",
      "durationIssue": "Tableau 11 : total imprimé 100, somme des phases 110. Durées à confirmer ; aucune application automatique.",
      "sourceIds": [
        "fao56-kc",
        "fao56-root"
      ],
      "automaticExample": false
    },
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Tableau 11 : total imprimé 100, somme des phases 110. Durées à confirmer ; aucune application automatique."
    ]
  },
  {
    "id": "fonio",
    "name": "Fonio blanc",
    "scientificName": "Digitaria exilis",
    "group": "Céréales",
    "notes": [
      "Diversification ; variété et cycle souvent courts, à renseigner."
    ],
    "nutrition": "N/P/K ; pas de recette chiffrée locale qualifiée acquise dans cette version.",
    "ecology": {
      "phOptimal": [
        5.5,
        6.5
      ],
      "phAbsolute": [
        4.5,
        7.1
      ],
      "temperatureOptimalC": [
        22.0,
        27.0
      ],
      "annualRainOptimalMm": [
        900.0,
        1600.0
      ],
      "sourceId": "ecocrop-fonio"
    },
    "water": null,
    "eceThresholdDsM": null,
    "missing": [
      "Variété, stades observés, profil hydrique initial, météo et efficacité réelles ; validation agronomique locale non réalisée.",
      "Kc, profondeur racinaire, fraction p et durées de stades adaptés à acquérir ; aucun calendrier chiffré automatique."
    ]
  }
];
export function cropById(id: string) { return CROPS.find(c => c.id === id); }
/** Stage examples are scenarios, not phenology calibration. Root growth is an
 * explicit interpolation assumption, capped by the real supplied soil depth. */
export function applyCropProfile(c: SeasonalConfig, id: string, confirmedDays?: number[]): SeasonalConfig {
 if(c.managementPlan&&c.managementPlan.cropId!==id)c={...c,managementPlan:undefined};
 const p = cropById(id);
 if (!p) throw new Error('Culture inconnue.');
 if (!p.water || id === 'rice-flooded') return {...c,crop:p.name,cropProfile:{id,version:CATALOG_VERSION,mode:'reference'},nutritionReference:undefined,stages:[],parameterSource:'Paramètres hydriques manquants ou système hors domaine : compléter une référence locale.',systemDomain:id==='rice-flooded'?'flooded_rice':'upland'};
 const w = p.water;
 if (w.durationIssue && !confirmedDays) throw new Error(w.durationIssue);
 const days = confirmedDays ?? w.stageExampleDays;
 if(days.length!==4 || days.some(v=>!Number.isInteger(v)||v<1) || days.reduce((a,b)=>a+b,0)>366)throw new Error('Quatre durées positives, total de 366 jours maximum requis.');
 const depth = c.soil.layers.reduce((s,l)=>s+l.thicknessM,0);
 const rootMax = Math.min(w.rootRangeM[0],depth), rootInitial=Math.min(.15,rootMax);
 const roots=[rootInitial,rootInitial+(rootMax-rootInitial)*.25,rootMax,rootMax,rootMax];
 const kc=[w.kc[0],w.kc[0],w.kc[1],w.kc[1],w.kc[2]];
 const names=['Installation (phase hydrique)','Développement du couvert','Pleine couverture','Fin de cycle'];
 const stages:Stage[]=days.map((duration,i)=>({name:names[i],days:duration,kcStart:kc[i],kcEnd:kc[i+1],rootStartM:roots[i],rootEndM:roots[i+1],depletionFraction:w.pAtEtc5}));
 const source=`FAO56 tableaux 11/12/22 ; scénario ${p.name}, ${confirmedDays?'durées confirmées par saisie':w.stageExampleContext}. Kc non ajustés au climat. Racines : départ hypothétique ${rootInitial} m, interpolation jusqu’à ${rootMax} m limitée par le sol décrit ; p ajusté à ETc (équation 83). À adapter à la variété et aux observations.`;
 // Weather from the previous crop cannot silently define a longer new cycle.
 const end=new Date(Date.parse(c.sowingDate)+(days.reduce((a,b)=>a+b,0)-1)*86400000).toISOString().slice(0,10);
 return {...c,crop:p.name,cropProfile:{id,version:CATALOG_VERSION,mode:'reference'},nutritionReference:undefined,adjustDepletionToEtc:true,stages,parameterSource:source,systemDomain:'upland',weather:c.weather.filter(w=>w.date>=c.sowingDate&&w.date<=end),system:{...c.system,targetDepletionFraction:Math.min(c.system.targetDepletionFraction,.05)}};
}
/** FAO56 equation 83. This changes the management threshold, not ET demand. */
export function depletionAtDemand(pAt5: number, etcMmDay: number) { return Math.max(.1,Math.min(.8,pAt5+.04*(5-etcMmDay))); }
