# Site School Cup

Site réalisé par **Pierre MOALIC**.

Le site du tournoi de football du Lycée Sacré-Cœur La Salle (Angers) : un stade 3D de nuit, une cinématique
d'entrée, les scores en direct, le tableau, les buteurs, les équipes, et l'espace organisateurs `/admin`.

## Lancer le site sur ton ordinateur

Il faut [Node.js](https://nodejs.org) (version 20 ou plus). Dans un terminal ouvert dans ce dossier `site/` :

```bash
npm install
```

```bash
npm run dev
```

Puis ouvre <http://localhost:5173> (le site) et <http://localhost:5173/admin> (l'admin).

**Tester le direct sans Supabase :** ouvre le site dans un onglet et `/admin` dans un autre. Valide un but dans
l'admin : la célébration « BUUUT ! » se déclenche dans l'onglet du site. Les données d'exemple sont marquées
« Données d'exemple » ; dans l'admin, Réglages → « Tout effacer » permet de repartir de zéro.

Autres commandes : `npm run build` (prépare la version en ligne dans `dist/`), `npm run preview` (la teste).

**Avant chaque mise en ligne, lance les tests** : ils jouent un tournoi complet (tableau de 2 à 16 équipes,
buts, annulation, tirs au but, qualification, champion, règle des photos) et disent en 2 secondes si quelque chose est cassé.

```bash
npm test
```

## Ce qui protège le site contre les bugs

- **3D qui échoue** (vieux téléphone, carte graphique capricieuse, téléphone qui récupère la mémoire) : le site
  passe tout seul sur un fond fixe, le contenu reste utilisable. Si seuls les effets d'image donnent un écran noir,
  ils sont détectés et désactivés au démarrage.
- **Cinématique** : quoi qu'il arrive, on entre dans le site au plus tard 4 s après la fin prévue du vol.
- **Navigation privée** (Safari) : le stockage du navigateur peut être bloqué, le site continue sans.
- **Jour J à plusieurs organisateurs** : c'est la base qui ajoute +1 au score à chaque but, donc deux buts validés
  en même temps sont tous les deux comptés ; « Annuler » retire exactement le but qu'on vient de saisir.
- **Réseau du lycée ou 4G instable** : en plus du temps réel, le site recharge les scores toutes les 30 s,
  au retour du réseau et quand le téléphone sort de veille.
- **Erreur d'enregistrement** dans l'admin : un message clair s'affiche et l'écran recharge les vraies données
  (jamais de faux score affiché).

Pour forcer la qualité 3D (utile pour tester un petit téléphone) : `http://localhost:5173/?qualite=low` (ou `mid`, `high`).

## Comment c'est construit (à expliquer à l'oral)

| Brique | Rôle | Pourquoi ce choix |
|---|---|---|
| **Vite + React + TypeScript** | Le squelette du site et des pages | React découpe l'écran en composants réutilisables ; TypeScript détecte les erreurs avant qu'elles arrivent chez les visiteurs |
| **Three.js** | Le stade 3D | La référence de la 3D dans le navigateur. On l'utilise directement (sans surcouche) pour garder le contrôle total sur la vitesse sur téléphone |
| **Supabase** | Base de données, connexion admin, temps réel, photos | Gratuit, et prévient instantanément tous les téléphones quand un score change |
| **Vercel** | Hébergement | Gratuit, rapide, met à jour le site à chaque publication sur GitHub |

### Le stade est entièrement « dessiné par le code »

Aucun modèle 3D n'est téléchargé : pelouse, tribunes, foule, projecteurs, ville… tout est fabriqué au chargement
à partir de formes simples. Résultat : le site entier pèse environ **270 Ko compressés** (le cahier des charges
autorisait 8 Mo), ce qui compte quand 300 élèves l'ouvrent en 4G en même temps pendant la finale.

Quelques techniques utilisées :
- **Instancing** : les quelque 13 000 supporters (moins sur téléphone) sont dessinés en quelques appels à la carte graphique.
- **Shaders** : de petits programmes qui tournent sur la carte graphique animent la ola, les bras levés, les sauts
  sur un but, les drapeaux, les filets, les bandes de tonte (qui changent selon l'angle de vue, comme en vrai).
- **Éclairage réaliste** : 4 projecteurs avec de vraies ombres, matériaux « PBR », tone mapping cinéma (ACES),
  lueur des lumières (*bloom*), faisceaux visibles dans la brume, grain et vignettage façon caméra TV.
- **Qualité adaptée à l'appareil** : moins de supporters et d'effets sur les petits téléphones, et la résolution
  baisse toute seule si les images par seconde chutent.

## Où se trouve quoi

```
src/
├── main.tsx, App.tsx      démarrage, aiguillage site public / admin
├── data/
│   ├── types.ts           la forme des données (équipe, joueur, match, but…)
│   ├── bracket.ts         la logique du tournoi : tableau, vainqueur, minute, classement des buteurs
│   ├── demo.ts            les données d'exemple
│   ├── store.ts           la mémoire du site + toutes les actions de l'admin
│   └── supabase.ts        le branchement à Supabase
├── stadium/               le stade 3D (un fichier par élément : pelouse, tribunes, foule, lumières…)
│   └── Stadium.ts         le chef d'orchestre et la caméra (cinématique, vue drone)
├── audio/sound.ts         l'ambiance sonore générée par le navigateur
├── public/                les pages du site (intro, direct, tableau, buteurs, équipes, infos)
├── admin/                 l'espace organisateurs
├── ui/                    icônes et petits éléments partagés
└── styles/global.css      couleurs, polices, mise en page
supabase/schema.sql        la base de données à créer dans Supabase
```

## Sons

Le son est fabriqué par le navigateur (rumeur, clameur faite de dizaines de « voix », sifflet, applaudissements).
Pour un rendu encore plus réaliste, dépose de vrais enregistrements dans `public/sons/` avec ces noms exacts :
`foule.mp3` (ambiance en boucle), `but.mp3` (clameur de but), `sifflet.mp3`. Ils remplacent automatiquement
les sons générés. Voir `../assets/CREDITS.md` pour où les trouver (licence libre).

## Règles respectées

- Aucune donnée inventée affichée comme vraie : bandeau « Données d'exemple » tant que l'admin ne l'a pas décoché.
- Photo d'un élève affichée seulement si l'autorisation droit à l'image est cochée, vérifié à trois endroits :
  dans l'admin, dans le site, et dans la base de données elle-même (règle `photo_needs_consent`).
- Prénom + initiale du nom seulement (RGPD).
- Aucun logo ni marque de tiers.
- Son jamais automatique ; `prefers-reduced-motion` respecté (pas de vol de caméra, fondu direct) ;
  navigation au clavier ; le contenu s'affiche même si la 3D ne marche pas (image de fond fixe).
