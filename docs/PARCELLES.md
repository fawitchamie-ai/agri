# Parcelles — tracé guidé et limites

Le parcours s’organise en trois étapes : trouver le terrain, poser ses coins, confirmer la surface. La confirmation est possible après « Terminer », pour un contour valide situé dans un pays de simulation. La géométrie reste la source des surfaces et coordonnées côté serveur.

## Utilisation

1. Choisir le pays, rechercher une localité ou utiliser sa position GPS avec l’autorisation du navigateur.
2. Choisir Satellite pour repérer les limites, Plan pour les routes. Le changement de fond conserve les coins. Les images peuvent être anciennes ou décalées.
3. Activer « Dessiner mon champ ». Le mode par défaut affiche un repère fixe au centre : déplacer la carte sous ce repère et appuyer sur « Poser le coin ». Les mouvements de carte ne créent aucun coin. À faible zoom, le bouton rapproche la carte ; le tracé requiert le zoom 14 au minimum.
4. Poser au moins trois coins dans l’ordre. Annuler retire le dernier ; les repères peuvent être déplacés pendant l’édition. Le mode « Clic sur la carte » reste disponible. La fermeture exige « Terminer » ; aucune fermeture automatique à proximité du premier coin.
5. Vérifier la surface en m² et hectares, puis confirmer. Choisir une culture et préparer ses données ou un scénario explicitement hypothétique.

Les coordonnées GPS, l’import et l’export d’un contour restent disponibles en alternative. Le continent peut être exploré ; les simulations proposées restent limitées aux six pays et aux paramètres disponibles. Un contour cartographique ne suffit pas à valider une prévision parcellaire.

## Fluidité

- Carte Leaflet 2D unique, sans initialisation WebGL ni bascule automatique entre moteurs.
- Satellite en tuiles, chargé à la demande pour la zone visible. Le module du plan vectoriel et ses métadonnées ne sont chargés qu’après sélection de Plan.
- Géométrie et repères conservés et mis à jour en place ; aucune suppression/recréation globale à chaque coin.
- Aucun import asynchrone lors de l’ajout d’un coin ; les clics ne dépendent pas du chargement des fonds.
- Géométrie validée et pays détecté uniquement après modification des points, pas pendant les mouvements de carte. État React du viewport transmis à l’arrêt du mouvement.
- Rendu vectoriel du plan découpé avec des pauses pour laisser traiter les interactions ; requêtes des tuiles sorties de la vue annulées.
- Les contours des pays sont non interactifs et masqués au zoom du terrain. Ils ne capturent pas les clics.
- Cibles de 44 à 48 pixels pour les commandes principales et les poignées. Aucune promesse de délai identique sur tous les appareils et réseaux.

## Excès d’eau

La surface du contour adapte les volumes hydriques. Le moteur ne prédit pas le rendement parcellaire ni la mortalité après engorgement. Déclarer un sol engorgé ou des plantes submergées bloque le calendrier entier et laisse les volumes totaux inconnus, sans transformer ce blocage en perte de rendement chiffrée. Une forte pluie déclenche un avertissement sur l’hypothèse de drainage libre ; elle ne prouve pas une inondation.

Pour quantifier une perte, il faut un modèle approprié et calibré : drainage réel, saturation et nappe, durée et profondeur de submersion, culture, variété, stade, température, reprise et rendements observés. Le chapitre 3 de la documentation FAO AquaCrop distingue le stress d’aération et sa durée : https://www.fao.org/fileadmin/user_upload/faowater/docs/AquaCropV40Chapter3.pdf. Ces paramètres ne sont pas remplacés par un pourcentage universel.

## Vérification de cette révision

Contrôle TypeScript ; tests des géométries, surfaces et volumes ; tests de blocage par engorgement/submersion et d’avertissement après excédent ; tests des routes et autorisations. Vérification navigateur sur un contour fictif : recherche de localité, déplacement sans coin accidentel, quatre coins, fermeture et confirmation. Les essais dans le navigateur ne remplacent pas un test tactile sur le téléphone de l’utilisateur ou une validation agronomique au champ.
