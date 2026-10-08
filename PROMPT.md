# Prompt à coller dans Claude Code

Ouvre Claude Code **dans ce dossier** (`school-cup-projet`), puis copie-colle tout le texte entre les deux lignes.
Claude Code lira aussi `CLAUDE.md` tout seul.

---

Tu vas construire le site du **School Cup**, le tournoi de football de mon lycée (Lycée Sacré-Cœur La Salle, Angers).
Tout le contexte est dans ce dossier :

- `CLAUDE.md` : le résumé et les règles de travail
- `docs/cahier-des-charges.md` : les fonctionnalités, les pages, la base de données, l'admin
- `docs/direction-artistique.md` : le style, les couleurs, les polices et le storyboard de la cinématique
- `maquettes/school-cup-3d.html` : la maquette validée, à reprendre et à pousser beaucoup plus loin
- `assets/` : mes modèles 3D, photos, sons et logo (lis le README de chaque dossier pour savoir ce qui est déjà là)

**L'objectif :** que les élèves soient émerveillés en ouvrant le site, comme au lancement d'un jeu vidéo de foot,
avant même d'aller au tournoi. Le site doit aussi être fiable le jour J (scores en direct sur tous les téléphones).

## LA PRIORITÉ ABSOLUE : IL FAUT QU'ON S'Y CROIE

Je ne veux pas un « joli site ». Je veux que la personne qui l'ouvre ait l'impression d'**être vraiment dans le stade,
le soir de la finale**. Il faut que ce soit magnifique. La maquette actuelle est une base : le stade en blocs ne suffit pas,
il doit devenir **réaliste**. Ne te contente jamais de « ça marche » : ça doit être beau.

Le niveau visé, ce sont les introductions des jeux vidéo de foot récents et les retransmissions TV des grands matchs.
Concrètement, ça veut dire :

- **Lumière** : vraie nuit de match. Projecteurs puissants avec faisceaux visibles dans une légère brume, halos,
  pelouse éclairée de façon inégale (plus claire au centre), ombres douces des tribunes et des poteaux sur le terrain.
  Utilise un éclairage réaliste (matériaux PBR, environnement HDRI de nuit, tone mapping ACES, bloom bien dosé).
- **Matières** : pelouse avec du relief et des bandes de tonte qui accrochent la lumière, sièges de tribune,
  toits en métal qui reflètent les projecteurs, filets de but qui bougent légèrement.
- **Vie** : une foule qui a l'air vraie (personnages variés, drapeaux, écharpes, fumigènes de couleur or si ça reste
  joli), flashs de téléphones, ola, foule qui se lève sur un but. Le stade ne doit jamais avoir l'air vide ou figé.
- **Caméra** : des mouvements de cinéma, fluides, avec une sensation de vitesse et de profondeur (flou de mouvement
  léger, profondeur de champ à l'arrivée sur le terrain).
- **Son** : ambiance de stade crédible, qui monte pendant la cinématique et éclate à l'arrivée (utilise les sons de
  `assets/sons/` s'il y en a ; sinon propose-moi des banques de sons libres de droits).
- **Finitions** : chaque détail compte : transitions, typographie, survols, chargement. Même l'écran de chargement
  doit être beau.

**Ta façon de vérifier :** après chaque étape visuelle, fais des captures et juge-les sévèrement, comme un directeur
artistique de jeu vidéo. Pose-toi la question : « est-ce qu'un élève qui voit ça se dit *wouah* ? ». Si la réponse
n'est pas un oui franc, liste ce qui fait « faux » ou « amateur » et corrige avant de passer à la suite. Montre-moi les
captures à chaque étape.

Si un résultat vraiment réaliste demande quelque chose que tu ne peux pas créer toi-même (un modèle 3D de stade,
des personnages, des textures, des sons), **dis-le-moi clairement** et indique-moi où le trouver gratuitement ou pas cher
(avec une licence qui autorise l'utilisation), plutôt que de te contenter d'une version moins belle.
Mais garde toujours le site rapide sur téléphone : le réalisme ne doit pas le rendre inutilisable.

**Avant d'écrire du code :**
1. Lis tous les fichiers de `docs/` et `CLAUDE.md`.
2. Ouvre `maquettes/school-cup-3d.html` avec Playwright. Fais des captures avant et après le clic sur
   « Entrer dans le stade », en desktop (1440×900) et en mobile (390×844). Décris-moi ce que tu vois et
   ce que tu améliorerais.
3. Regarde ce qu'il y a dans `assets/`.
4. Propose-moi un plan en étapes (avec ce que je pourrai tester à la fin de chaque étape) et pose-moi
   tes questions. Attends ma validation avant de commencer.

**Ordre de construction souhaité :**
1. Le projet de base (Vite + React + TypeScript) avec la scène 3D du stade reprise de la maquette, en mieux :
   utilise le modèle de stade de `assets/stade-3d/` s'il y en a un, sinon améliore le stade procédural.
2. La cinématique d'entrée complète, en suivant le storyboard de `docs/direction-artistique.md`, avec le son.
3. Les pages publiques (accueil, direct, tableau, buteurs, équipes, infos) par-dessus le stade.
4. Supabase : tables, sécurité, connexion admin, temps réel. Explique-moi chaque étape à faire de mon côté
   (création du compte, clés à copier) comme à un débutant.
5. L'espace admin complet (gestion des équipes, joueurs, photos, matchs, buts, paramètres du tournoi).
6. La célébration « BUUUT ! » déclenchée chez tous les visiteurs quand un but est validé.
7. Optimisation mobile, accessibilité, tests, puis mise en ligne sur Vercel avec mon nom de domaine.

**Méthode :** après chaque étape, lance le site, fais des captures desktop et mobile, vérifie que rien n'est cassé
ou moche, corrige, puis montre-moi le résultat et dis-moi comment le tester moi-même.

---
