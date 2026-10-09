# Logo School Cup — à utiliser partout sur le site

Ce dossier va dans `assets/logo/`. Il remplace le logo typographique de la maquette.

Le logo principal est **réaliste** : or poli en relief, lettres argent en 3D, fond bleu nuit texturé, éclats de lumière.
Les versions plates servent seulement quand le réaliste ne marche pas (très petit, impression, broderie).

## Les fichiers (chacun en SVG et en PNG transparent haute définition)

| Fichier | Usage |
|---|---|
| `school-cup-ecusson` | **Logo principal** : intro du site, écran de chargement, célébration de but, cartes |
| `school-cup-horizontal` | Menu du site (fond sombre), bannières |
| `school-cup-horizontal-fond-clair` | Fonds clairs : affiches, documents |
| `school-cup-icone` | Favicon, icône d'appli (PWA), réseaux sociaux, écran géant du stade |
| `school-cup-ecusson-plat`, `-horizontal-plat`, `-icone-plat` | Version plate (sans relief) pour les très petites tailles (< 48 px) |
| `school-cup-ecusson-blanc` | Une couleur blanche : **peint sur la pelouse** au rond central, sur photos, sérigraphie |
| `school-cup-ecusson-noir` | Une couleur bleu nuit : impression une couleur |

## Conseils techniques

- Le SVG réaliste utilise des filtres SVG (relief, grain, ombres). Il est parfait en grand, mais pour les performances
  sur téléphone, utiliser plutôt le **PNG** (ou un WebP converti depuis le PNG) quand le logo est affiché en grand
  et animé (intro, célébration).
- Dans le stade 3D : texture du rond central = version **blanche** (comme de la peinture sur l'herbe) ;
  panneaux LED et écran géant = **icône** réaliste.
- Le logo a déjà une ombre portée : ne pas en rajouter une.

## Règles

- Ne pas déformer, recolorer ou ajouter de contour au logo.
- Garder un espace libre autour (au moins la largeur d'une lettre).
- Les lettres sont dessinées sur mesure (pas de police) : ne pas les retaper avec une police.

## Couleurs

| Nom | Hex |
|---|---|
| Bleu School Cup | `#1C2F6E` |
| Bleu nuit | `#070D24` |
| Or | `#FFC63D` |
| Or clair | `#FFE7A3` |
| Or foncé | `#A8740A` |
| Blanc cassé | `#F6F4EC` |

## Idées d'intégration pour un effet « wouah »

- Intro : l'écusson apparaît dans le noir, un reflet de lumière balaie l'or de gauche à droite, les éclats scintillent,
  un halo doré respire derrière.
- Célébration de but : l'écusson passe en grand derrière « BUUUT ! ».
- Maillot du joueur 3D : écusson en petit à gauche du cœur.
