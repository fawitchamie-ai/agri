# Architecture et contrats

Le système est un monolithe modulaire TypeScript : vues React, routes serveur compatibles Next.js dans Vinext, base SQLite D1 durable, migrations Drizzle. La pile fournie par Sites est retenue afin de disposer d’une version hébergée exécutable, sans PostgreSQL externe ni service à maintenir. Les opérations scientifiques ne sont pas exécutées dans le navigateur. Les résultats sont intégrés sous forme de tables. Les entraînements de préparation reproduisent le protocole v24 existant; aucun entraînement n’est lancé à la consultation.

## Modules
- `public/scientific-data.json` : résultats reconstruits et observations historiques avec filiation.
- `science-source/` et `scripts/extract-notebook.py` : protocole v24 exact extrait et vérifications reproductibles.
- `app/api/` : accès, persistance, imports et exports, séparés des vues.
- `db/schema.ts`, `drizzle/` : schéma et migrations suivies.
- `lib/calculations.ts` : calculs et règles métier vérifiables.
- `app/page.tsx`, `components/agri/`, `app/globals.css` : interface française responsive.

## Portée des données
Les imports sont versionnés; les simulations conservent une référence et les hypothèses utilisées. Les données scientifiques ne sont pas remplacées par les récoltes communautaires. Les quatre catégories de collecte ne sont jamais additionnées dans un « total récolte ». Les identités, coopératives et droits sont vérifiés côté serveur. Les environnements fictifs sont séparés des espaces réels.

## Calculs
Production simulée t = rendement t/ha × superficie ha. Production kg = tonnes ×1000. Sacs équivalents = kg/poids du sac en kg. Rendement observé t/ha = quantité normalisée t/superficie récoltée ha. Rendement agrégé = somme des productions compatibles / somme des superficies compatibles. Les valeurs manquantes ne sont pas transformées en zéro.

Comparaison : erreur = prévision−observation, MAE = moyenne |erreur|, RMSE = racine moyenne erreur², biais = moyenne erreur. Seules les paires compatibles sont retenues; l’effectif et la période sont affichés. Les agrégations simples de lignes ne sont pas les scores macro-annuels du notebook.

## Connexion limitée
Pas de photographies lourdes ni de carte automatique. Graphiques SVG et tableaux HTML; données scientifiques chargées une seule fois. Messages hors connexion et saisies conservées en cas d’échec; aucune promesse de synchronisation hors ligne automatique. Le JSON scientifique représente environ 2,51Mo non compressés (environ 72Ko gzip) et le coût du chargement initial reste à prendre en compte sur réseau lent.

## Dépendances
React/React DOM portent les vues; Next/Vinext les routes et le rendu; Drizzle le schéma et les migrations; Vite/Cloudflare Workers l’exécution; Tailwind le socle CSS. Les composants graphiques et le PDF sont vectoriels sans bibliothèque lourde ni appel externe. Les dépendances UI inutilisées du starter ont été retirées. Les autres outils de développement servent à TypeScript, la compilation, les migrations et la prévisualisation.
