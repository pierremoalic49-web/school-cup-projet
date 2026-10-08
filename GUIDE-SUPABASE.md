# Relier le site à Supabase (pas à pas, pour débutant)

Sans Supabase, le site marche en **mode démo** : les scores restent dans ton navigateur.
Avec Supabase, tout le monde voit les scores **en direct** sur son téléphone, et seuls les organisateurs peuvent les modifier.
Compte environ 20 minutes. C'est gratuit.

## 1. Créer le compte et le projet

1. Va sur <https://supabase.com> → **Start your project** → connecte-toi (avec GitHub, c'est le plus simple).
2. **New project** :
   - Name : `school-cup`
   - Database password : clique sur **Generate**, puis **note-le dans un endroit sûr** (tu n'en auras presque jamais besoin, mais il ne se récupère pas).
   - Region : **Europe (Paris)** ou **Europe (Frankfurt)**.
3. Attends 1 à 2 minutes que le projet soit prêt.

## 2. Créer les tables (copier-coller)

1. Menu de gauche → **SQL Editor** → **New query**.
2. Ouvre le fichier `site/supabase/schema.sql`, copie **tout** son contenu, colle-le, clique **Run**.
3. Tu dois voir « Success. No rows returned ». C'est normal.

Ce script crée les tables (équipes, joueurs, matchs, buts, réglages), active la sécurité
(**tout le monde lit, seuls les admins écrivent**), le temps réel, et le dossier des photos.

## 3. Bloquer les inscriptions publiques

Personne ne doit pouvoir se créer un compte tout seul.
**Authentication** → **Sign In / Providers** → désactive **Allow new users to sign up** → **Save**.

## 4. Créer les comptes organisateurs

**Authentication** → **Users** → **Add user** → **Create new user** :
- un email et un mot de passe **par organisateur** (pas de mot de passe partagé) ;
- coche **Auto Confirm User**.

## 5. Copier les clés dans le site

1. En haut de la page du projet, clique sur **Connect** (ou **Project Settings → API Keys**).
2. Repère :
   - l'**URL du projet** (`https://xxxx.supabase.co`) ;
   - la **Publishable key** (commence par `sb_publishable_`). Si ton projet n'affiche que l'ancienne « anon key », c'est la même chose.
3. Dans le dossier `site/`, copie le fichier `.env.example`, renomme la copie en `.env`, et remplace les deux valeurs.

> ⚠️ Ne mets **jamais** la clé « secret » ou « service_role » dans le site. La clé publishable, elle, peut être vue par tout le monde : ce sont les règles de sécurité de l'étape 2 qui protègent les données.

## 6. Donner les droits d'admin

Retourne dans **SQL Editor** → **New query**, colle ceci en remplaçant l'email, puis **Run**
(une fois par organisateur) :

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'prenom.nom@exemple.fr';
```

## 7. Tester

1. Dans le dossier `site/` : `npm run dev` (arrête-le avec Ctrl+C et relance-le si il tournait déjà, pour qu'il lise le `.env`).
2. Ouvre <http://localhost:5173/admin> → connecte-toi avec un compte organisateur.
3. Dans **Réglages** → **Tout effacer** pour partir d'une base vide, puis crée les équipes, les joueurs, et le tableau.
4. Ouvre le site public sur ton téléphone (ou un autre onglet) : quand tu valides un but dans l'admin, la célébration « BUUUT ! » apparaît partout.

## En cas de problème

| Ce que tu vois | Pourquoi | Solution |
|---|---|---|
| « Ce compte n'a pas le droit de modifier » | Le compte n'est pas dans la table `admins` | Refais l'étape 6 avec le bon email |
| « Email ou mot de passe incorrect » | Faute de frappe, ou compte non confirmé | Vérifie dans Authentication → Users |
| Le site reste en « Mode démo » | Le `.env` n'est pas lu | Le fichier doit s'appeler exactement `.env`, dans `site/`, puis relance `npm run dev` |
| Les scores ne bougent pas tout seuls | Temps réel non activé | Relance tout le script `schema.sql` (il peut être exécuté plusieurs fois sans risque) |
