# Skelvo Stream

Outils **100 % gratuits** pour streamers et créateurs : on règle tout en direct, on copie un lien, on le colle dans OBS ou Streamlabs (source « Navigateur »). Sans compte, sans filigrane, rien à installer.

En ligne : https://skelvo.fr/skelvo-stream/

## Outils
**Sur le stream** (overlays à coller dans OBS, source « Navigateur ») :
- `cadre/` : cadre caméra animé (8 styles, étiquette, masque PNG).
- `tchat/` : tchat Twitch à l'écran (4 thèmes, emotes 7TV / BTTV / FFZ, badges).
- `alertes/` : alertes d'abonnement, subs offerts, bits et raids, avec sons synthétisés.
- `emotes/` : pluie d'emotes (pluie, rebonds, bulles, explosion), jet sur les raids.
- `ecrans/` : écrans « Ça commence bientôt », « Pause », « Fin », compte à rebours, réseaux, tchat intégré.
- `musique/` : musique en cours via Last.fm (Spotify n'ouvre plus son API aux petits outils).
- `sous-titres/` : sous-titres en direct. Page micro dans Chrome (`index.html`) → overlay OBS via PeerJS, traduction locale avec l'API Translator de Chrome.

**Avec le tchat** (commandes des modos, valeurs mémorisées dans OBS) :
- `compteur/` : `!mort+`, `!mort-`, `!mort= 12`.
- `sondage/` : `!sondage Question | A | B`, votes en tapant 1, 2, 3…, `!sondage fin`.
- `minuteur/` : subathon, `!timer start | pause | +10m | -5m | set 2h | reset`.
- `objectif/` : subs, bits ou manuel, `!objectif +5 | = 20 | reset`.

**Plus** :
- `giveaway/` : tirage au sort (`!participer`, `!giveaway start | stop | tirage | annule`), machine à sous ou roue.
- `derniers/` : dernier abonné, sub offert, raid, bits, tops du jour (`!derniers reset`).
- `jeux/` : duels (`!duel @pseudo`, `!accepte`) et courses (`!course`).
- `horloge/` : heure, date, durée du live (`!uptime reset`), compte à rebours.

**Kit et outils du streamer** :
- `kit/` : un pack + une chaîne -> tous les liens et une collection de scènes OBS à importer (Début, Live, Pause, Fin).
- `transitions/` : vidéo Stinger avec cache (track matte) générée dans le navigateur.
- `debuter/` : guide pour débuter le stream avec OBS.

**Packs** : `assets/packs.js` (thème + couleurs du contour + fond) et `assets/bg/` (textures, et miniatures `-mini`).

**Pour le streamer** :
- `voix/` : lecture vocale du tchat (page à garder ouverte dans un onglet).
- `images/` : emotes et badges redimensionnés, panneaux de profil, bannières.

À venir : follows et points de chaîne (connexion Twitch), application de bureau pour lire le tchat sur un seul écran.

## Technique
Site statique hébergé sur GitHub Pages : aucun serveur, aucune étape de build. Les réglages de chaque overlay sont dans les paramètres de son URL.

## Structure
- `index.html` : accueil.
- `.nojekyll` : sert les fichiers tels quels sur GitHub Pages.
- `assets/app.css`, `assets/app.js` : styles et outils partagés des pages éditeur
  (formulaire → URL, mémorisation des réglages, copie, aperçu à l'échelle, traduction).
- `assets/overlay.js` : utilitaires des overlays (réglages, stockage, polices, durées).
- `assets/twitch.js` : connexion anonyme au tchat Twitch, événements (subs, bits, raids),
  commandes, emotes 7TV / BTTV / FFZ et faux tchat de démonstration.
- `assets/vendor/peerjs-1.5.4.min.js` : liaison directe navigateur → OBS (sous-titres).
- Chaque outil a son dossier : `index.html` (l'éditeur) et `overlay.html` (la page collée dans OBS).

Les overlays n'utilisent que `overlay.js` et `twitch.js` : ils doivent rester
légers et transparents. Dans l'aperçu des éditeurs, les réglages leur sont envoyés
par `postMessage` pour ne pas recharger la page.

⚠️ Les noms des paramètres d'URL (`style`, `c1`, `ch`, `theme`…) sont utilisés
par les streamers dans OBS : ne jamais les renommer, seulement en ajouter.

## Tchat Twitch
Tous les outils liés au tchat passent par `assets/twitch.js`. Connexion anonyme au tchat (WebSocket IRC officiel, pseudo `justinfanXXXX`).
Emotes Twitch via le CDN officiel, emotes 7TV / BTTV / FFZ via leurs API publiques.
Messages supprimés par les modos (CLEARMSG / CLEARCHAT) retirés de l'écran.

## Traduction
Le français est écrit directement dans le HTML. Pour ajouter une langue :
créer `assets/lang-en.js` avec `SK.dict.en = { 'clé': 'texte', … }` (clés = attributs
`data-i18n` des pages) et le charger après `app.js`. La langue suit le navigateur
ou `?lang=en`.

## Last.fm (musique)
La clé API Last.fm de Skelvo Stream est dans `DEFAULT_KEY`, en haut de
`musique/overlay.html` (clé publique de lecture : normal qu'elle soit visible).
Les streamers n'entrent que leur pseudo Last.fm ; ils peuvent mettre leur propre
clé dans les réglages avancés si la clé partagée était saturée.

## Mettre à jour
À chaque mise en ligne :
- changer le numéro dans `version.txt` **et** `SK.VERSION` (en haut de la partie « Version »
  de `assets/app.js`) : les pages restées ouvertes affichent alors le bandeau
  « Version x disponible · Rafraîchir », comme sur Tribune ;
- après une modification de `assets/`, augmenter les `?v=` dans les pages HTML.
