# School Cup — dossier pour Claude Code

> **Le site est construit** dans le dossier `site/`. Pour le lancer : voir `site/README.md`.
> Ensuite : `GUIDE-SUPABASE.md` (scores en direct pour tout le monde) puis `GUIDE-MISE-EN-LIGNE.md`.

## Comment l'utiliser

1. Dézippe ce dossier où tu veux sur ton ordinateur (par exemple dans `Documents`).
2. Remplis ce que tu peux dans `assets/` (voir `assets/README.md`) : un modèle 3D de stade fera la plus grosse différence.
3. Ouvre un terminal **dans ce dossier** et lance `claude` (ou ouvre le dossier depuis l'application Claude Code).
4. Copie-colle le prompt qui se trouve dans `PROMPT.md`.
5. Laisse-le lire, regarder la maquette et te proposer un plan. Valide le plan, puis avance étape par étape.

## Ce qu'il y a dedans

```
school-cup-projet/
├── LISEZ-MOI.md               ← ce fichier (pour toi)
├── PROMPT.md                  ← le prompt à coller dans Claude Code
├── CLAUDE.md                  ← le contexte que Claude Code lit tout seul
├── docs/
│   ├── cahier-des-charges.md  ← pages, admin, base de données, hébergement, points légaux
│   └── direction-artistique.md← style, couleurs, polices, storyboard de la cinématique
├── maquettes/
│   ├── README.md              ← ce que montre la maquette et ce qu'il faut améliorer
│   └── school-cup-3d.html     ← la maquette 3D (double-clic, avec internet)
└── assets/                    ← tes modèles 3D, photos, sons, logo
```

## À préparer de ton côté (Claude Code te guidera)

- Un compte **GitHub** (gratuit) pour sauvegarder le code.
- Un compte **Supabase** (gratuit) pour la base de données et la connexion admin.
- Un compte **Vercel** (gratuit) pour mettre le site en ligne.
- Un **nom de domaine** (environ 7 à 15 € par an pour un `.fr`), une fois le site prêt.
- Les **autorisations de droit à l'image** signées par les parents, via la direction du lycée.
