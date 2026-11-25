# Distribution sans alerte SmartScreen

L’installateur NSIS public actuellement compilé n’a pas de signature Authenticode. Changer son nom, le placer dans un ZIP ou créer un certificat autosigné ne retire pas l’alerte de réputation SmartScreen. Une signature OV peut afficher un éditeur vérifié, mais ne garantit pas l’absence d’alerte au premier téléchargement.

La distribution prévue est **Microsoft Store avec un paquet MSIX** : après certification, Microsoft signe le paquet et l’installation depuis le Store ne déclenche pas l’avertissement SmartScreen de téléchargement. Ce projet garde le format NSIS pour le développement et crée séparément un paquet MSIX de soumission.

1. Créez et faites vérifier un compte développeur sur [storedeveloper.microsoft.com](https://storedeveloper.microsoft.com/). La vérification d’identité et l’acceptation des contrats se font personnellement.
2. Réservez **AgriPrévision** dans Partner Center. Copiez exactement les valeurs **Package/Identity Name**, **Package/Identity Publisher** et le nom d’éditeur affiché. La réservation peut attribuer un nom d’identité différent du nom visible de l’application.
3. Dans GitHub Actions, lancez **Préparer le paquet Microsoft Store** → **Run workflow** et renseignez ces trois valeurs. Téléchargez l’artefact MSIX produit.
4. Soumettez ce MSIX dans Partner Center avec la fiche, les captures et les informations exigées. Attendez la certification et utilisez le lien du Store pour l’installation. Le MSIX généré par la CI est volontairement non signé et n’est **pas** un téléchargement destiné aux utilisateurs.

La CI teste la structure du paquet avec MakeAppx. Elle ne peut pas certifier l’application, créer un compte développeur ou garantir le comportement de la connexion Cloudflare Access sur un PC réel. Le runtime WebView2 est nécessaire à l’exécution sur Windows ; vérifiez sa présence et le parcours d’authentification sur une installation de test avant la soumission.
