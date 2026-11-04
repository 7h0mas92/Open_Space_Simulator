# État d'avancement : Interface, menus, options, back-office, PWA

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Menu principal refondu ; sans serveur, la fenêtre Connexion explique que les comptes sont
  indisponibles et le jeu reste jouable en invité.
- Interface de jeu refondue : en haut ce qu'on lit (jauges, trésorerie en mois, horloge), en
  bas ce qu'on fait (dock d'actions et commande de l'étape).
- Back-office refondu : tuiles de cartes, filtres combinables, duplication, réactivation,
  nombre de tirages par carte (`GET /api/admin/events` renvoie `draws`).
- Options compactes : Guide du jeu en 3 parties repliables. L'option Slack IA n'apparaît que
  pour un joueur connecté sur un serveur qui a une clé d'API. Débit du Slack limité
  (`packages/client/src/slack/pacing.ts` : 2 messages d'affilée puis 1 toutes les 20 s,
  urgences toujours publiées, IA appelée au plus toutes les 45 s).
- « Continuer » ne propose plus une partie terminée : à la fin, sa sauvegarde automatique est
  effacée (appareil et serveur) et sa date de fin notée ; ses sauvegardes manuelles restent dans
  « Charger une partie » (`saves.markFinished`, `saves.latestResumable` dans
  `client/src/save/saves.ts`). Un Daily rejoué reste proposé.
- Nouvelle partie depuis le menu : avec une partie en cours, l'accueil affiche « Continuer » et,
  dessous, « Nouvelle partie » (mode suggéré : Facile au premier lancement, puis Normal), en plus
  des cartes des modes (`ui/menu/HomeMenu.tsx`). La sauvegarde automatique marche aussi en
  `pnpm dev` : `installGameLifecycle` se rebranche après le double montage de StrictMode.
- Mise à jour du jeu installé (`ui/appUpdate.ts`, PWA en `registerType: 'prompt'`) : après un
  déploiement, la nouvelle version s'applique toute seule au menu, ou au retour au menu si une
  partie est en cours (rien n'est perdu). Recherche d'une mise à jour toutes les 30 min et au
  retour sur l'onglet. Dépendance `workbox-window` ajoutée au client.
- Version du jeu en bas du menu principal (`src/version.ts`, `__APP_BUILD__` écrit par
  `vite.config.ts`) : « Version 0.1.0 · commit · date du build », pour savoir quelle version tourne.

- Raccourcis 1/2/4 (vitesse), K (Kanban), T (équipe) et liste des raccourcis dans les options ; alerte « sprint trop chargé » au Kanban et sur le bouton de lancement ; démo : résultat net et dev du sprint (#171).
- Interface réorganisée : onglet « Locaux » (abonnements, hall, serveurs, ménage, chats) dans le dock, Stats dans la barre du haut, Business en trois onglets (prix, clients, support), catalogue de construction en 4 familles + inventaire.
- Un seul accès par élément : les abonnements (internet, sécurité, ménage…) ne se gèrent plus que dans Locaux > Abonnements ; le hall, les serveurs et les chats ne s'ouvrent plus depuis le catalogue de construction (seulement depuis Locaux) ; le ménage garde son bouton jauge dans la barre du haut et sort de Locaux.
