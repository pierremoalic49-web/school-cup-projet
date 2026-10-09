# Musique du site School Cup — instructions pour Claude Code

## Le morceau

| | |
|---|---|
| Titre | Arena Hype Anthem |
| Auteur | BudgetPixel AI |
| Durée | 50 secondes |
| Style | Rock de stade, rapide, guitare saturée, énergie « poing levé » |
| Licence | CC BY 4.0 (gratuit, crédit obligatoire) |
| Source | https://budgetpixel.com/background-music/arena-hype-anthem-2a10f6b2 |
| Fichier | `assets/sons/arena-hype-anthem.mp3` |

Si le fichier n'est pas dans `assets/sons/`, dis-le-moi : je dois le télécharger depuis la source.

## Comment l'utiliser sur le site

### 1. Démarrage
- La musique démarre **uniquement au clic** sur « Entrer dans le stade » (les navigateurs bloquent le son automatique,
  et un son qui part tout seul est désagréable).
- Elle démarre en même temps que la cinématique d'entrée.

### 2. Synchronisation avec la cinématique
- La cinématique dure environ **7 secondes** ; l'arrivée au bord du terrain se fait à **7 s**
  (flash blanc, confettis, coup de sifflet).
- Le **moment le plus fort du morceau** (entrée de la batterie ou du refrain) doit tomber pile sur cette arrivée.
  Écoute le morceau (analyse la forme d'onde si besoin), repère ce moment et choisis le point de départ du morceau
  en conséquence. Si besoin, ajoute un fondu d'entrée sur les premières secondes.

### 3. Après l'arrivée
- La musique continue en **boucle**, avec un volume plus bas, **sous** la rumeur de la foule.
- Boucle sans coupure audible : fondu enchaîné entre la fin et le début.
- Après environ 2 minutes, baisser encore le volume (la musique devient une ambiance de fond, pas une gêne).

### 4. Pendant un but (« BUUUT ! »)
- La musique **baisse** pendant 3 à 4 secondes pour laisser passer la clameur de la foule et les coups de sifflet,
  puis remonte doucement.

### 5. Contrôles
- Le bouton son du menu coupe **tout** (musique + ambiance + bruitages). Retenir le choix du visiteur
  (localStorage, entouré d'un try/catch).
- Respecter les visiteurs qui ont « réduire les animations » : intro sans vol de caméra, mais la musique reste possible au clic.

### 6. Technique
- Utiliser la Web Audio API (un nœud de gain par piste : musique, foule, bruitages, et un gain général),
  pour pouvoir faire des fondus propres et baisser la musique pendant les buts.
- Précharger le fichier pendant que le visiteur regarde la vue du ciel, pour qu'il n'y ait aucun retard au clic.
- Compresser le MP3 (128 à 160 kb/s suffit) pour que le site reste rapide en 4G.

## Crédit obligatoire

La licence CC BY 4.0 impose d'afficher ce crédit sur le site, dans le pied de page ou une page « Crédits » :

> “Arena Hype Anthem” by BudgetPixel AI (https://budgetpixel.com/background-music/arena-hype-anthem-2a10f6b2) — CC BY 4.0 — modifié

(« modifié » parce que le morceau est coupé, bouclé et mixé.) Le lien doit être cliquable.
Ajoute aussi la ligne dans `assets/CREDITS.md`.

## Vérification

Une fois intégré, teste et dis-moi :
- que la musique ne démarre jamais sans clic ;
- que le moment fort tombe bien sur l'arrivée dans le stade ;
- que la boucle ne s'entend pas ;
- que le bouton son coupe tout et que le choix est retenu ;
- que le crédit est visible sur le site.
