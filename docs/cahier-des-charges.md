# Cahier des charges — School Cup

## 1. Objectif

Un site qui sert à deux choses :

1. **Faire rêver** : une expérience immersive (stade 3D de nuit, cinématique, son) qui donne envie de participer
   et de venir voir les matchs.
2. **Informer en direct** pendant les deux jours : scores, tableau, buteurs, programme, sur téléphone.

Public : élèves, profs, parents. Usage principal : **téléphone**, souvent en 4G dans la cour ou au bord du terrain.

## 2. Le tournoi

| Élément | Valeur |
|---|---|
| Nom | School Cup |
| Organisateur | Élèves du Lycée Sacré-Cœur La Salle, Angers |
| Durée | 2 jours |
| Jour 1 | Tournoi garçons |
| Jour 2 | Tournoi filles |
| Format | Élimination directe (tirs au but si égalité) |
| Nombre d'équipes | Non décidé : gérer 4, 8 ou 16 équipes par tournoi |
| Dates, lieu, horaires | À confirmer : paramètres modifiables dans l'admin |

## 3. Pages publiques

### 3.1 Intro (première visite)
- Stade 3D vu du ciel, logo School Cup en grand, bouton « Entrer dans le stade ».
- Au clic : cinématique (voir `direction-artistique.md`), puis le site apparaît par-dessus le stade.
- Bouton « Passer » pendant la cinématique. Les visites suivantes peuvent proposer une intro courte.
- Si l'utilisateur a activé « réduire les animations » : pas de vol de caméra, fondu direct.
- Si l'appareil ne gère pas la 3D : image de fond fixe (photo ou rendu du stade) + logo.

### 3.2 Accueil
- Titre fort, match en cours mis en avant, bandeau défilant d'actus (buts, résultats, prochains matchs).
- Bouton son (couper / activer).

### 3.3 Direct
- Score du ou des matchs en cours, minute (saisie ou calculée depuis l'heure de coup d'envoi), terrain.
- Liste des buts du match (minute, buteur, équipe).
- Mise à jour **en temps réel** sans recharger la page.

### 3.4 Tableau
- Arbre d'élimination directe, onglet Jour 1 garçons / Jour 2 filles.
- Matchs : à venir / en cours / terminé ; vainqueur mis en valeur ; tirs au but affichés.
- La finale et le trophée mis en scène.

### 3.5 Meilleurs buteurs
- Classement séparé garçons / filles (et un classement général optionnel).
- Cartes joueurs façon jeu vidéo : note (fun, définie par l'admin ou calculée), poste, buts, matchs, buts/match,
  photo ou silhouette.
- Le meilleur buteur a une carte dorée.

### 3.6 Équipes
- Liste des équipes (classe, couleurs, joueurs, capitaine).

### 3.7 Infos pratiques
- Dates, lieu, horaires, règlement simplifié, contact organisateurs.

## 4. Espace admin

Accès : page `/admin`, connexion par **email + mot de passe** (comptes organisateurs créés à l'avance).
Pas de mot de passe unique partagé si possible ; au minimum, un compte par organisateur.

| Fonction | Détail |
|---|---|
| Paramètres | Dates, lieu, horaires, textes de la page infos |
| Équipes | Créer / modifier / supprimer, couleurs, tournoi (garçons ou filles) |
| Joueurs | Nom (prénom + initiale du nom), équipe, poste, note, **case autorisation droit à l'image**, photo |
| Photos | Envoi depuis le téléphone ; recadrage simple ; refus si la case autorisation n'est pas cochée |
| Matchs | Générer le tableau à partir des équipes, horaires, terrain, statut (à venir / en cours / mi-temps / terminé) |
| Buts | Bouton « But » → choix du buteur → score mis à jour + célébration chez tous les visiteurs |
| Correction | Annuler le dernier but, corriger un score, tirs au but |
| Qualification | Le vainqueur passe automatiquement au tour suivant |

L'écran de saisie des buts doit être **utilisable d'une main sur téléphone**, au bord du terrain, en plein soleil :
gros boutons, fort contraste, confirmation avant suppression.

## 5. Données (proposition Supabase)

- `settings` : nom, dates, lieu, textes.
- `tournaments` : id, nom (« Garçons », « Filles »), jour, date.
- `teams` : id, tournament_id, nom, classe, couleur_1, couleur_2.
- `players` : id, team_id, prenom, initiale_nom, poste, note, photo_url, consentement_image (booléen).
- `matches` : id, tournament_id, tour (quart, demi, finale…), ordre, team_a_id, team_b_id, score_a, score_b,
  tab_a, tab_b, statut, coup_envoi, terrain, next_match_id, next_slot.
- `goals` : id, match_id, player_id, team_id, minute, created_at.
- `admins` : liste des comptes autorisés à modifier.

Sécurité (Row Level Security) : **lecture publique**, **écriture réservée aux admins**.
Les photos sont stockées dans Supabase Storage ; l'URL n'est affichée publiquement que si `consentement_image = true`.
Le classement des buteurs est calculé à partir de `goals` (vue SQL), jamais saisi à la main.

Temps réel : le site public s'abonne aux changements de `matches` et `goals`. Un nouveau but déclenche
la célébration « BUUUT ! » chez tous les visiteurs qui ont la page ouverte.

## 6. Hébergement

- Vercel (gratuit pour ce volume) + nom de domaine à acheter (ex. un `.fr`).
- HTTPS automatique.
- Prévoir le pic de connexions pendant la finale : le site public doit rester léger (assets 3D compressés,
  chargement progressif).

## 7. Performance et accessibilité

- Modèle 3D compressé (glTF + Draco ou Meshopt), textures en KTX2 ou WebP, poids total de la scène visé < 8 Mo.
- Qualité 3D adaptée à l'appareil (moins de foule, pas de bloom sur les petits téléphones).
- Le contenu (scores, tableau) doit s'afficher même si la 3D charge encore ou échoue.
- Textes lisibles (contraste suffisant), navigation au clavier, `prefers-reduced-motion` respecté.
- Son jamais automatique : il démarre au clic sur « Entrer dans le stade ».

## 8. Points légaux à respecter

- **Droit à l'image** : autorisation écrite des parents pour chaque joueur mineur avant toute photo publiée.
  Passer par la direction du lycée.
- **Données personnelles (RGPD)** : prénom + initiale du nom seulement, pas de date de naissance, pas de contact d'élève.
- **Marques** : aucun logo ou élément graphique de FIFA, EA Sports, d'un club ou d'une ligue.
- **Stade réel** : utiliser le nom ou l'image d'un vrai stade seulement si le tournoi s'y déroule réellement
  ou avec l'accord du propriétaire. Une vidéo de drone en ville demande une autorisation de vol.

## 9. Hors périmètre pour l'instant

- Inscriptions des équipes en ligne, billetterie, paris, chat.
