# Révélation des joueurs en 3D — instructions pour Claude Code

À lire avec `CLAUDE.md`, `docs/direction-artistique.md` et `assets/logo/LOGO.md` (l'écusson va sur le maillot).

## Ce que je veux

Quand on clique sur une **carte joueur**, on voit apparaître **le joueur en 3D, hyper réaliste, en tenue de foot School Cup**,
qui **fait un pas en avant vers nous**, comme dans la présentation des joueurs d'un jeu vidéo de foot.
**On ne voit jamais son visage.** Il faut que ce soit un moment « wouah » : quand quelqu'un clique sur sa propre carte,
il doit avoir l'impression d'être une star.

Il y a **deux personnages** : un **garçon** (tournoi garçons) et une **fille** (tournoi filles).
Le même personnage sert pour tous les joueurs du même tournoi ; seuls **le numéro, le nom au dos et les stats** changent.

## Le niveau de réalisme attendu

Hyper réaliste, pas un personnage de dessin animé :
- corps et proportions réalistes, peau crédible sur les bras et les jambes ;
- **tenue complète** : maillot, short, chaussettes hautes, protège-tibias sous les chaussettes, crampons ;
- tissu crédible (plis, légère brillance du maillot technique, coutures, numéro thermocollé) ;
- animation naturelle : respiration au repos, transfert du poids du corps pendant le pas, bras qui suivent le mouvement ;
- éclairage de stade de nuit, cohérent avec le reste du site.

Tu ne peux pas fabriquer toi-même un humain hyper réaliste à partir de rien. Utilise des personnages existants :
- **Mixamo** (gratuit, compte Adobe) : personnages riggés et animations (marche, « idle », célébrations, poses de foot) ;
- **Sketchfab** / **CGTrader** : modèles de footballeurs riggés (vérifier que la licence autorise l'usage sur un site web) ;
- d'autres sources si tu en connais de meilleures, en me disant la licence.

Puis **personnalise la tenue** dans Blender (tu peux piloter Blender en Python si je l'installe) : textures du maillot School Cup,
export en `.glb` optimisé. Si une étape demande que je télécharge ou crée un compte, explique-moi exactement quoi faire.

## La tenue School Cup

| Élément | Détail |
|---|---|
| Maillot | Bleu nuit (`#1C2F6E` → `#070D24` dans les ombres), col en V doré, bandes dorées sur les épaules, au bout des manches et sur les côtés |
| Devant | Écusson School Cup (`assets/logo/`) à gauche du cœur, « SCHOOL CUP » en blanc en travers de la poitrine, numéro doré au centre |
| Dos | Nom du joueur en majuscules + grand numéro doré |
| Short | Bleu nuit, bande dorée sur les côtés |
| Chaussettes | Bleu nuit, revers doré |
| Crampons | Noirs avec détails dorés |
| Or | `#FFC63D` (clair `#FFE7A3`, foncé `#A8740A`) |

Le **numéro et le nom** doivent être générés dynamiquement pour chaque joueur (texture dessinée dans un canvas
et appliquée sur le maillot, ou décalcomanies 3D), pas un modèle par joueur.

## Le visage ne doit jamais se voir

Les joueurs sont des mineurs et ce personnage n'est pas eux : le visage reste caché, mais de façon élégante, pas un gros rond noir.
Propose-moi la meilleure solution parmi :
1. **éclairage** : lumière qui vient d'en haut et de derrière, le visage reste dans l'ombre profonde (effet « contre-jour » de cinéma) ;
2. **flou noir** qui suit la tête (masque en post-traitement attaché à l'os de la tête), discret et doux ;
3. **cadrage** : la caméra coupe au niveau du menton, on voit le corps et le maillot.

Mon idée de départ, c'est un flou noir discret. Teste au moins deux solutions, fais des captures et montre-les-moi.
Dans tous les cas : aucun visage détaillé dans le modèle (supprime ou simplifie le visage si besoin).

## La scène, seconde par seconde

| Temps | Ce qu'on voit | Son |
|---|---|---|
| Clic | La carte se retourne et s'agrandit en plein écran, le site s'assombrit derrière. | « Whoosh » léger |
| 0,3 s | Noir, un projecteur s'allume au-dessus d'un sol sombre et brillant (sortie du tunnel ou bord de terrain de nuit). Fumée légère au sol. | Coup sourd |
| 0,6 s | Le joueur est là, de face, dans la lumière, au repos, il respire. Le reste est dans le noir. | Rumeur de foule lointaine |
| 1,2 s | **Il fait un pas vers nous** (un ou deux pas, puis s'arrête en appui solide, poitrine en avant). La caméra recule très légèrement pour garder le cadre. Le numéro sur le maillot accroche la lumière. | Foule qui monte |
| 2,2 s | Il prend une pose : bras croisés, ou ballon sous le pied, ou poing serré. Les particules dorées montent. | Clameur courte |
| 2,4 s | Les infos apparaissent autour de lui comme dans un jeu vidéo : la note en grand qui compte de 0 au chiffre, le poste, le nom en grosses lettres, la classe, puis les stats (matchs, buts, buts/match) qui se remplissent en barres. | Petits « tics » à chaque stat |
| ensuite | Le joueur reste vivant (respiration, petit mouvement). On peut le faire tourner doucement en glissant le doigt ou la souris. Bouton « Fermer » et touche Échap. | |

Variantes selon le joueur :
- **meilleur buteur** du tournoi : lumière dorée plus forte, plus de particules, pose de célébration ;
- **gardien** : gants, maillot de couleur différente (à proposer).

## Performance (c'est un site pour téléphone)

- Le modèle 3D ne se charge **qu'au premier clic** sur une carte (pas au chargement du site), avec un bel écran de chargement court.
- Fichier `.glb` compressé (Draco ou Meshopt, textures KTX2), **objectif : moins de 8 Mo par personnage**.
- Si le téléphone est trop faible : version allégée (moins de détails, pas de fumée), mais toujours la même scène.
- Option à étudier avec moi : rendre la scène dans Blender en vidéo (rendu encore plus réaliste) pour les appareils faibles,
  avec le numéro et le nom ajoutés par-dessus en 2D.
- Respecter « réduire les animations » : le joueur apparaît directement en pose, sans le pas.

## Vérification

- Captures desktop et mobile à 0,6 s, 1,5 s et 3 s de la scène, pour le garçon et pour la fille.
- Juge-les sévèrement : est-ce que ça fait « jeu vidéo » ou « amateur » ? Corrige avant de me montrer.
- Vérifie qu'on ne voit **jamais** de visage, sous aucun angle (y compris en faisant tourner le joueur).
- Vérifie le poids des fichiers et la fluidité sur un téléphone moyen.

## Rappel

Les vraies photos des joueurs (avec autorisation des parents) restent sur les cartes. Le personnage 3D est le même pour tous,
anonyme : il représente « un joueur de la School Cup », pas une personne précise.
