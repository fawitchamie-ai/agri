# Parcelles sur carte — refonte du 30 octobre 2026

## Parcours

L’accueil saisonnier commence par « Mon champ ». On choisit un pays africain,
cherche une ville, se rapproche du terrain, puis pose ses coins. Les sommets
restent déplaçables avant confirmation. La surface, le périmètre et un point
représentatif sont calculés à partir du contour. Une liste GPS permet la saisie
au clavier ainsi que l’import et l’export GeoJSON.

La carte propose la vue Terre, un plan détaillé et un affichage agrandi. MapLibre
affiche un globe lorsque WebGL est disponible ; Leaflet prend automatiquement
le relais si sa création échoue. Le plan Leaflet décode les tuiles vectorielles
OpenMapTiles dans Canvas, sans WebGL. Seules les tuiles visibles et leur petite
marge sont demandées ; aucun téléchargement de région ni proxy de tuiles.

L’exploration et l’export couvrent les pays et territoires africains du fond
Natural Earth. Le moteur saisonnier conserve sa couverture existante : Togo,
Bénin, Ghana, Burkina Faso, Côte d’Ivoire et Sénégal. Les autres pays sont
signalés comme exploration seule. Les 23 profils de culture, la chimie du sol,
les données météo et le moteur hydrique existants sont conservés.

Après confirmation, l’agriculteur peut préparer sa campagne avec ses données ou
accepter explicitement les hypothèses d’un scénario pédagogique. Ce dernier
emploie un sol fictif, ET0 de 5 mm/j, pluie nulle, efficacité d’application de
75 %, transport sans perte et eau supposée disponible. Il produit un bilan
hydrique et un calendrier, sans prévision de rendement ni prescription chimique
déduite du tracé. Débit, durée de pompage et quota restent inconnus.

## Géométrie et persistance

- GeoJSON WGS84 : coordonnées `[longitude, latitude]`, un Polygon fermé sans trou.
- De 3 à 200 sommets distincts ; coordonnées finies ; latitude entre −85 et 85°.
- Rejet des intersections, des sommets alignés consécutifs et d’une emprise de
  plus de 2° ; surface entre 1 m² et 100 000 ha.
- Aire sphérique avec rayon moyen terrestre de 6 371 008,8 m ; périmètre par
  distances de grand cercle. Centroïde local comme point représentatif ; pour
  un contour concave dont le centroïde sort, recours au premier sommet.
- La validation côté serveur recalcule surface et coordonnées représentatives :
  les champs déclarés par le client ne les remplacent pas.
- Géométrie enregistrée dans la configuration JSON existante, conservée dans les
  révisions et les exports ; aucune migration de base nécessaire.
- Une campagne portant des observations mesurées ou déclarées conserve son
  contour. Un autre champ exige une nouvelle campagne.

Les frontières Natural Earth sont approximatives : le pays suggéré demande une
confirmation lorsque le contour est proche d’une frontière ou sans correspondance.
Le dessin fournit une estimation, sans valeur cadastrale. Blue Marble est une
image de repérage à l’échelle du continent, pas une photographie récente du champ.
Le plan prend son relais au fort zoom. La qualité agronomique des données n’est
pas améliorée par le nombre de décimales des coordonnées.

## Sources et licences

Sources récupérées et documentation consultée le 30 octobre 2026 :

| Élément | Source | Conditions et transformation |
| --- | --- | --- |
| Pays | [Natural Earth 1:50m Admin 0](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson) | [Domaine public](https://www.naturalearthdata.com/about/terms-of-use/). Filtre Afrique, complété de Maurice et des Seychelles ; 56 entités. Propriétés réduites, coordonnées majoritairement arrondies à 5 décimales. |
| Villes | [GeoNames cities15000](https://download.geonames.org/export/dump/) | [CC BY](https://www.geonames.org/export/) : attribution GeoNames. Filtre des codes pays africains, 4 051 villes ; nom, nom ASCII, pays, latitude, longitude, population. |
| Recherche complémentaire | [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | Requête seulement après soumission explicite si le répertoire local ne répond pas ; 6 résultats maximum, délai 10 s. |
| Plan | [OpenFreeMap](https://openfreemap.org/quick_start/) | Style Liberty et métadonnées officielles ; attributions OpenFreeMap, OpenMapTiles, © OpenStreetMap visibles. Aucun appel au serveur raster tile.openstreetmap.org. |
| Vue Terre | [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) | BlueMarble_ShadedRelief_Bathymetry, EPSG:3857, niveau natif maximal 8 ; attribution NASA visible. |

SHA-256 des sources brutes :

- Natural Earth : `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`.
- Archive GeoNames cities15000.zip : `c89ba6601c29c98a717ef8ad021cdebe47f0de3f1c2ebe0a66f5fe7d60cdc352`.

Les tuiles externes révèlent au fournisseur l’emprise de carte affichée. Le
contour n’est pas envoyé à ces fournisseurs. La recherche transmet uniquement
le texte soumis au géocodeur complémentaire. « Me situer » demande l’autorisation
de géolocalisation du navigateur uniquement au clic ; aucune localisation au
chargement. Les campagnes continuent d’utiliser l’authentification, les espaces,
la base et les droits de l’application existante. Le brouillon local reste opt-in.

## Vérifications

- 93 tests automatisés réussis : surface comparée à une référence sphérique
  indépendante, sens du contour, concavité, géométries invalides, autorité du
  serveur sur la surface, proportionnalité des volumes, recherche locale Tsévié,
  persistance/révisions et verrouillage après observations.
- 14 contrôles d’intégration et 5 contrôles de régression réussis.
- TypeScript et compilation de production réussis.
- Vérification dans le navigateur de bureau : recherche Tsévié, plan détaillé,
  agrandissement, placement de quatre points fictifs, déplacement d’un sommet,
  confirmation, scénario explicitement accepté et calendrier généré.
- WebGL indisponible dans le navigateur de vérification : parcours Leaflet testé ;
  globe 3D non vérifié visuellement ici. Mise en page mobile implémentée, sans
  vérification sur appareil physique.
- Le contrôle de santé de production dépend des identifiants Cloudflare Access
  de service existants ; un contrôle ignoré faute d’identité ne constitue pas une
  preuve de santé authentifiée.
