# Direction artistique — School Cup

## L'idée

**« Le soir de la finale. »** Un stade de nuit, les projecteurs, la foule, la ville éclairée autour.
L'énergie d'un lancement de jeu vidéo de foot, mais une identité 100 % School Cup, propre à notre lycée.
Ce que la personne doit ressentir en ouvrant le site : *« c'est pas un site de lycée, ça. »*

Ce que le porteur du projet a demandé, mot pour mot dans l'esprit :
- une vue du ciel d'un stade, le logo School Cup en grand ;
- au clic, une cinématique qui nous emmène dans le stade ;
- ensuite, le site avec le stade en fond ;
- des animations « de fou », des cartes joueurs façon jeu vidéo, que les gens soient émerveillés sans même y aller.

## Le niveau de réalisme attendu

**Il faut qu'on s'y croie.** La maquette (stade en blocs, foule en cubes) montre l'idée, pas le niveau final.
La version finale doit ressembler à une image de jeu vidéo ou de retransmission TV de nuit :

- éclairage réaliste (matériaux PBR, HDRI de nuit, tone mapping ACES, ombres douces, brume légère sous les projecteurs) ;
- vraie géométrie de stade (modèle 3D ou modélisation détaillée : sièges, escaliers, garde-corps, structure du toit) ;
- pelouse crédible (bandes de tonte, relief, variations de couleur, reflets) ;
- foule crédible et vivante (silhouettes variées, écharpes, drapeaux, réactions aux buts) ;
- caméra de cinéma (fluidité, sensation de vitesse, profondeur de champ à l'arrivée).

Test à chaque étape : capture d'écran → « est-ce qu'un élève dit *wouah* ? ». Sinon, on corrige avant d'avancer.

## Couleurs

| Rôle | Couleur | Usage |
|---|---|---|
| Fond nuit | `#04060D` | Fond général, ciel |
| Panneau verre | `rgba(8,11,24,.74)` + flou | Blocs de contenu par-dessus le stade |
| Or | `#FFC63D` | Logo, accents, boutons principaux, meilleur buteur |
| Or clair | `#FFE7A3` | Reflets, textes d'accent |
| Or profond | `#A8740A` | Bas des dégradés dorés |
| Cyan | `#3FE3FF` | Accent secondaire, tournoi garçons |
| Rose | `#FF6FB0` | Accent tournoi filles |
| Rouge live | `#FF3B5C` | Uniquement pour « En direct » |
| Texte | `#F6F4EC` | Texte principal |
| Texte secondaire | `#A3A9C9` | Légendes |

Règle : l'or est la couleur de la gloire, il reste rare. Le rouge ne sert qu'au direct.

## Polices (Google Fonts)

- **Anton** : titres, logo, scores. Toujours en majuscules.
- **Barlow Condensed** (600–800) : étiquettes, boutons, menus, en majuscules espacées.
- **Work Sans** : textes courants.

## Le logo

Typographique pour l'instant : « SCHOOL » en blanc au-dessus de « CUP » en or (dégradé du clair au profond,
halo doré). Au-dessus : « LYCÉE SACRÉ-CŒUR LA SALLE · ANGERS ». En dessous : « TOURNOI DE FOOTBALL » entre deux filets dorés.
Si un vrai logo est créé, le déposer dans `assets/logo/` (SVG de préférence) : il remplace le logo typographique partout,
y compris peint au centre du terrain et sur les panneaux LED.

## Le stade 3D

- Stade rectangulaire à l'anglaise, 4 tribunes séparées, toits métalliques, coins ouverts.
- Pelouse tondue en bandes, lignes blanches réglementaires, **logo School Cup peint au rond central**.
- 4 mâts de projecteurs avec halos et faisceaux lumineux visibles.
- Panneaux LED autour du terrain qui défilent : « SCHOOL CUP · LYCÉE SACRÉ-CŒUR LA SALLE · ANGERS ».
- Foule animée (petits personnages ou instances) aux couleurs or, blanc, bleu nuit ; elle fait la ola en continu
  et saute pendant les célébrations. Flashs de téléphones dans les tribunes.
- Autour : la ville de nuit (lumières, bâtiments sombres), ciel étoilé, légère brume.
- Effet de lueur (bloom) sur les projecteurs et les panneaux LED.

Si un modèle 3D de stade est fourni dans `assets/stade-3d/`, il remplace le stade procédural de la maquette.

## Storyboard de la cinématique (≈ 7 secondes)

| Temps | Image | Son |
|---|---|---|
| Avant le clic | Vue du ciel à ~235 m, la caméra tourne très lentement autour du stade. Logo géant + halo doré qui respire. Bouton « Entrer dans le stade » avec un anneau qui pulse. Petit texte « Monte le son ». | Silence |
| 0,0 s (clic) | Le logo grossit et se floute en s'effaçant (on passe « à travers »). Bandes noires de cinéma qui glissent en haut et en bas. | La rumeur de la foule commence, très basse |
| 0,4 s | Texte : **ANGERS** | Rumeur qui monte |
| 0,5 → 3 s | La caméra descend en arc de cercle en s'approchant du stade, l'angle de vue s'élargit (effet de vitesse). | |
| 2,0 s | Texte : **UN STADE.** | |
| 3,3 s | Texte : **DEUX JOURS.** La caméra passe au-dessus du toit d'une tribune. | |
| 4,6 s | Texte : **UNE SEULE ÉCOLE.** (« école » en or). La caméra plonge devant la tribune, au-dessus des premiers rangs. | Foule forte |
| 7,0 s | Arrivée au bord du terrain, à hauteur d'homme, face au rond central. Flash blanc, léger tremblement, explosion de confettis depuis les 4 coins. Bandes noires qui se retirent. | Coup de sifflet + boum grave + clameur |
| après | Le site apparaît en fondu par-dessus le stade. La caméra dérive doucement. En faisant défiler, elle remonte au-dessus du stade comme un drone. | Rumeur de fond discrète, bouton pour couper |

Pistes pour aller plus loin : passage de la caméra dans le tunnel des joueurs, lumière des projecteurs qui s'allume
mât par mât à l'arrivée, nom du visiteur sur l'écran géant (s'il se connecte), ralenti au moment de l'entrée sur le terrain.

## La célébration « BUUUT ! »

Déclenchée quand un admin valide un but, chez tous les visiteurs :
- « BUUUT ! » géant en or qui claque à l'écran (zoom de 3× à 1×, légèrement penché), nom du buteur dessous ;
- flash blanc, tremblement de caméra, confettis côté de l'équipe qui marque, foule qui saute, flashs dans les tribunes ;
- clameur de la foule + trois coups de sifflet courts ;
- le score « rebondit » dans le bloc direct, la carte du buteur se met à jour.

## Cartes joueurs

Inspirées des cartes de jeu vidéo de foot, sans en copier le design :
note en grand en haut à gauche, poste dessous, nombre de buts en haut à droite, photo (ou silhouette) au centre,
nom en majuscules, classe, puis 3 statistiques (matchs, buts, buts/match).
Carte du meilleur buteur : fond or sombre, bordure dorée, halo. Au survol : la carte s'incline en 3D et un reflet la traverse.

## Mouvements

- Une grande scène (la cinématique) et des micro-animations au survol ; pas d'animations partout.
- Courbes rapides au début, douces à la fin (`cubic-bezier(.2,.8,.2,1)`).
- Tout respecte `prefers-reduced-motion`.

## À éviter

- Logos, polices ou visuels de FIFA, EA Sports, de clubs ou de ligues.
- Émojis comme icônes (utiliser des icônes SVG au trait).
- Faux chiffres présentés comme réels.
- Son qui démarre tout seul.
