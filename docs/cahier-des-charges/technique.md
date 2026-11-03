# Cahier des charges : données, API, assets, responsive, qualité

> Extrait du cahier des charges d'origine (anciennement dans `CLAUDE.md`). Index : [`CLAUDE.md`](../../CLAUDE.md).

# MODÈLE DE DONNÉES (Prisma, à compléter si nécessaire)

- User : id, email, passwordHash?, githubId?, pseudo, role, locale, createdAt
- Save : userId, slot (1 à 5), state Json, seed, mode, updatedAt
- EventCard : id, content Json (fr/en), conditions Json, choices Json, weight, cooldown, active
- Score : userId, mode, valuation, outcome, sprintsPlayed, seed, commandsLog Json,
  dailyDate?, createdAt
- Achievement : id, title Json, description Json, icon
- UserAchievement : userId, achievementId, unlockedAt
- EventStat : cardId, choiceIndex, count
- AiQuota : userId, date, count

# API REST

- Auth : register, login, logout, refresh, GitHub OAuth, GET /me
- Sauvegardes : CRUD /saves
- Événements : GET /events
- Scores :
  - POST /scores, avec rejeu côté serveur de la graine et des commandes pour vérifier le score et
    empêcher la triche ;
  - GET /scores/top?mode=&daily= ;
  - GET /scores/:id/replay.
- Daily : GET /daily (graine du jour)
- Succès : GET /achievements, POST /achievements/unlock
- Slack IA : POST /slack-ai/message
- Admin : CRUD /admin/events, GET /admin/stats
- Documentation OpenAPI générée automatiquement (Swagger UI).
- Format d'erreur homogène : { error: { code, message } }.

# ASSETS KENNEY

Je dépose moi-même les packs dans `packages/client/public/assets/kenney/<pack>/`. Par exemple :
un kit de mobilier 3D, des personnages 3D, un pack d'UI et des packs de sons.

- N'invente jamais un nom de fichier. Demande-moi d'abord la sortie de `ls -R`, puis génère un
  `assetManifest.ts` typé à partir de cette liste.
- Si un modèle manque, utilise une forme Three.js en remplacement et note-le dans une liste
  « assets manquants ».
- Ajoute une page Crédits dans le jeu et une section dans le README (Kenney, CC0).

# RESPONSIVE (OBLIGATOIRE)

- Le canvas Three.js prend tout l'écran et se redimensionne. Le devicePixelRatio est plafonné à 2.
- Desktop : HUD latéral, Slack ancré dans un coin.
- Mobile :
  - jauges compactes en haut, barre d'actions en bas ;
  - Kanban, boutique, Slack et cartes en bottom sheets plein écran ;
  - pinch pour zoomer, glisser pour déplacer la caméra, appui long pour sélectionner ;
  - glisser-déposer tactile dans le Kanban et en mode construction.
- Cibles tactiles d'au moins 44 px.
- Valider à 375, 768, 1024 et 1440 px de large, en portrait et en paysage, avec des tests
  Playwright sur ces viewports.
- Performances :
  - 60 fps visés sur desktop, 30 fps minimum sur mobile milieu de gamme ;
  - InstancedMesh pour le mobilier, LOD et désactivation des ombres sur mobile ;
  - qualité graphique réglable : bas, moyen, haut.

# QUALITÉ

- TypeScript strict. Aucun `any` non justifié.
- Couverture des tests de simulation supérieure à 80 %.
- Script `pnpm balance` qui simule 10 000 parties avec des stratégies automatiques et produit un
  rapport d'équilibrage : taux de faillite, valorisation moyenne, cartes trop fortes.
- Tests end-to-end Playwright sur les parcours principaux : inscription, partie, sauvegarde,
  classement.
- ESLint, Prettier, commits conventionnels.
- README complet : installation, architecture avec schémas, choix techniques, ce que l'app fait
  et ne fait pas, captures d'écran et GIFs, crédits.
