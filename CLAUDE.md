# School Cup — contexte du projet

Ce fichier est lu automatiquement par Claude Code. Il résume le projet ; le détail est dans `docs/`.

## En une phrase

Site web du **School Cup**, tournoi de football du Lycée Sacré-Cœur La Salle (Angers) : une expérience
immersive façon jeu vidéo de foot (stade 3D de nuit, cinématique d'entrée), le direct des matchs,
le tableau du tournoi, les meilleurs buteurs, et un espace admin protégé pour saisir les scores et les buts.

## Le tournoi

- 2 jours : **jour 1 tournoi garçons**, **jour 2 tournoi filles**.
- Format : **élimination directe** (quarts, demies, finale ; tirs au but en cas d'égalité).
- Nombre d'équipes : **pas encore décidé** → le site doit gérer un nombre d'équipes variable (4, 8 ou 16).
- Dates et lieu : **à confirmer** → rester en paramètres modifiables depuis l'admin, jamais en dur.

## État actuel (octobre 2026)

Le site est construit dans `site/` (Vite + React + TypeScript + Three.js en direct, sans R3F). Voir `site/README.md`.
- Stade 100 % procédural (`site/src/stadium/`), cinématique, site public complet, admin complet, célébration « BUUUT ! ».
- Données : mode local (localStorage + BroadcastChannel entre onglets) tant que `site/.env` n'a pas les clés Supabase ;
  schéma prêt dans `site/supabase/schema.sql`. Guides : `GUIDE-SUPABASE.md`, `GUIDE-MISE-EN-LIGNE.md`.
- Pièges connus : MSAA sur le render target désactivé (écran noir sur certains GPU) ; `smoothstep` toujours avec
  bord1 < bord2 ; shaders précompilés via `compileAsync` (sinon gel en plein vol sous Windows).
- Tests : `npm test` dans `site/` (Vitest, 33 tests : tableau 2→16 équipes, buts, annulation, tirs au but, champion,
  photos). Les lancer après toute modification de `src/data/`. Le score des buts est incrémenté par un trigger SQL
  en mode Supabase (`serverScores`) ; les actions admin envoient des modifications partielles (`patch`), jamais la ligne entière.
- Reste à faire côté porteur du projet : compte Supabase, comptes organisateurs, vraies équipes, sons réels optionnels,
  mise en ligne Vercel + domaine. Côté code : tester sur de vrais téléphones (iPhone + Android moyen).

## Ce qui existe déjà

- `maquettes/school-cup-3d.html` : **maquette de référence validée**. S'ouvre dans un navigateur
  (connexion internet nécessaire, elle charge Three.js depuis un CDN). Elle montre le style, la
  cinématique, la structure des pages et la démo admin. C'est la base à reprendre et améliorer, pas à jeter.
- `docs/cahier-des-charges.md` : fonctionnalités, pages, données, règles admin.
- `docs/direction-artistique.md` : couleurs, polices, storyboard de la cinématique seconde par seconde.
- `assets/` : dossiers où le porteur du projet dépose modèles 3D, photos, sons et logo.

## Exigence numéro 1 : il faut qu'on s'y croie

Le porteur du projet veut que ce soit **magnifique** et **réaliste** : on doit avoir l'impression d'être dans le stade
un soir de finale. « Ça fonctionne » ne suffit pas. Chaque étape visuelle est jugée sur captures, sévèrement,
et corrigée tant que le résultat ne provoque pas un « wouah ». Le détail des critères est dans `PROMPT.md`
et `docs/direction-artistique.md`.

## Règles pour travailler

1. **Regarder la maquette avant de coder** : l'ouvrir avec Playwright (ou un navigateur), cliquer
   sur « Entrer dans le stade », faire des captures desktop (1440×900) et mobile (390×844).
2. **Vérifier visuellement chaque étape** : après chaque grosse modification, relancer le site, faire
   des captures et corriger ce qui ne va pas avant de continuer.
3. **Mobile d'abord** : le public regardera sur téléphone dans la cour. Viser 60 images/s sur un
   iPhone récent et rester utilisable sur un Android moyen (qualité 3D réduite automatiquement).
4. **Aucune donnée inventée affichée comme vraie** : équipes, joueurs, dates = données d'exemple
   clairement marquées tant que l'admin ne les a pas saisies.
5. **Photos des élèves** : affichées uniquement si la case « autorisation droit à l'image » est cochée
   pour ce joueur. Sinon, silhouette. La plupart des joueurs sont mineurs.
6. **Pas de logos ou marques de tiers** (FIFA, EA Sports, clubs) : l'esprit jeu vidéo, mais une identité 100 % School Cup.
7. Expliquer les choix techniques simplement : le porteur du projet est lycéen (Première STMG),
   il doit pouvoir comprendre et présenter le projet.

## Stack recommandée (voir le cahier des charges pour le détail)

Vite + React + TypeScript · React Three Fiber + drei + postprocessing · GSAP · Supabase
(base de données, connexion admin, temps réel, stockage des photos) · Vercel (hébergement + nom de domaine).
