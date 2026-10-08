# Mettre le site en ligne (GitHub + Vercel + nom de domaine)

À faire **après** avoir relié Supabase (voir `GUIDE-SUPABASE.md`). Gratuit, sauf le nom de domaine (environ 7 à 15 € par an).

## 1. Sauvegarder le code sur GitHub

Git n'est pas installé sur cet ordinateur. Le plus simple pour débuter : **GitHub Desktop**.

1. Crée un compte sur <https://github.com>.
2. Installe **GitHub Desktop** (<https://desktop.github.com>) et connecte-toi.
3. **File → Add local repository** → choisis le dossier `school-cup-projet` → il propose de créer un dépôt : accepte (**create a repository**).
4. Vérifie que le fichier `.env` **n'apparaît pas** dans la liste des fichiers : il contient tes clés, il est volontairement ignoré.
5. Écris un message (« Première version du site ») → **Commit to main** → **Publish repository** (laisse **Keep this code private** coché).

> Conseil : mets le dossier du projet **hors de OneDrive** (par exemple `C:\Projets\school-cup`) avant de commencer. OneDrive synchronise mal les milliers de petits fichiers de `node_modules` et bloque parfois les suppressions.

## 2. Héberger sur Vercel

1. Va sur <https://vercel.com> → **Sign up** avec ton compte GitHub.
2. **Add New → Project** → choisis ton dépôt `school-cup-projet` → **Import**.
3. Réglages :
   - **Root Directory** : `site` (important : le site est dans ce sous-dossier) ;
   - **Framework Preset** : Vite (détecté tout seul) ;
   - **Environment Variables** : ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` avec les mêmes valeurs que ton `.env`.
4. **Deploy**. Une minute plus tard, le site est en ligne sur une adresse du type `school-cup-xxxx.vercel.app`.

À chaque fois que tu publies un changement depuis GitHub Desktop (**Commit** puis **Push origin**), Vercel remet le site à jour tout seul.

## 3. Ton nom de domaine

1. Achète un nom chez un registraire français (OVHcloud, Gandi…), par exemple `schoolcup-angers.fr`.
2. Vercel → ton projet → **Settings → Domains** → ajoute ton nom.
3. Vercel affiche 1 ou 2 lignes DNS à recopier (type `A` et/ou `CNAME`) : colle-les dans la zone DNS chez ton registraire.
4. Attends de quelques minutes à quelques heures. Le HTTPS (cadenas) est automatique.

## 4. Avant le jour J

- [ ] Les vraies équipes et les vrais joueurs sont saisis ; la case « Afficher Données d'exemple » est **décochée** dans Réglages.
- [ ] Les dates, le lieu et les horaires sont remplis dans Réglages.
- [ ] Les photos ne sont ajoutées **que** pour les joueurs dont l'autorisation des parents a été remise à la direction.
- [ ] Chaque organisateur a testé sa connexion à `/admin` **sur son téléphone**.
- [ ] Test « grandeur nature » : un organisateur valide un but, trois personnes vérifient sur leur téléphone que la célébration apparaît.
- [ ] Le lien du site est affiché dans la cour (un QR code fonctionne très bien).
