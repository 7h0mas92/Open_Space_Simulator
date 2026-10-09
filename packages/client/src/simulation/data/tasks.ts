import type { DecorTheme, Phase, TaskType } from '@oss/shared';

/** Titres des tâches générées dans le backlog, par type : paires [français, anglais]. */
export const TASK_TITLES: Record<TaskType, readonly (readonly [string, string])[]> = {
  FEATURE: [
    ['Connexion avec Google', 'Sign in with Google'],
    ['Mode sombre', 'Dark mode'],
    ['Notifications push (beaucoup)', 'Push notifications (lots of them)'],
    ['Export PDF', 'PDF export'],
    ['Tableau de bord des stats', 'Stats dashboard'],
    ['Chatbot IA dans un coin', 'AI chatbot in a corner'],
    ['Paiement par abonnement', 'Subscription billing'],
    ['Application mobile (« juste une webview »)', 'Mobile app ("just a webview")'],
    ['Recherche plein texte', 'Full-text search'],
    ['Partage sur les réseaux sociaux', 'Social sharing'],
    ['Onboarding en 12 étapes', '12-step onboarding'],
    ['Programme de parrainage', 'Referral program'],
    ['Mode hors ligne', 'Offline mode'],
    ['Fil d’activité en temps réel', 'Real-time activity feed'],
    ['Emojis personnalisés', 'Custom emojis'],
    ['API publique', 'Public API'],
    ['Intégration Slack', 'Slack integration'],
    ['Badges et gamification', 'Badges and gamification'],
    ['Import Excel', 'Excel import'],
    ['Page « À propos » avec photos d’équipe', '"About us" page with team photos'],
    ['Abonnement premium doré', 'Golden premium plan'],
    ['Recommandations « personnalisées »', '"Personalised" recommendations'],
    ['Calendrier partagé', 'Shared calendar'],
    ['Commentaires sous chaque page', 'Comments under every page'],
    ['Glisser-déposer partout', 'Drag and drop everywhere'],
    ['Version pour montre connectée', 'Smartwatch version'],
    ['Un bouton « Annuler » qui annule vraiment', 'An "Undo" button that actually undoes'],
    ['Connexion par lien magique', 'Magic link sign-in'],
    ['Authentification à deux facteurs', 'Two-factor authentication'],
    ['Thèmes de couleur personnalisables', 'Customisable colour themes'],
    ['Tutoriel animé avec une mascotte', 'Animated tutorial with a mascot'],
    ['Mode « focus » sans distractions', 'Distraction-free "focus" mode'],
    ['Webhooks pour les développeurs', 'Webhooks for developers'],
    ['Raccourcis clavier façon vim', 'Vim-style keyboard shortcuts'],
    ['Avatar généré par IA', 'AI-generated avatar'],
    ['Historique des versions', 'Version history'],
    ['Traduction en 14 langues', 'Translation into 14 languages'],
    ['Widget pour l’écran d’accueil', 'Home screen widget'],
    ['Facturation en plusieurs devises', 'Multi-currency billing'],
    ['Un Kanban dans notre app aussi', 'A Kanban board in our app too'],
    ['Édition à plusieurs en temps réel', 'Real-time collaborative editing'],
    ['Sondages intégrés', 'Built-in polls'],
  ],
  REFACTO: [
    ['Découper le fichier utils.ts (4 000 lignes)', 'Split utils.ts (4,000 lines)'],
    ['Supprimer le code commenté de 2019', 'Delete commented-out code from 2019'],
    ['Renommer `data2` et `dataFinal`', 'Rename `data2` and `dataFinal`'],
    ['Migrer de jQuery à quelque chose', 'Migrate from jQuery to something'],
    ['Typer les `any` du module paiement', 'Type the `any`s in the payment module'],
    ['Extraire la God Class', 'Extract the God Class'],
    ['Écrire enfin des tests', 'Finally write tests'],
    ['Mettre à jour les dépendances (387 alertes)', 'Update dependencies (387 alerts)'],
    ['Remplacer les copier-coller par une fonction', 'Replace copy-pastes with a function'],
    ['Nettoyer les feature flags oubliés', 'Clean up forgotten feature flags'],
    ['Réécrire le module legacy « temporaire »', 'Rewrite the "temporary" legacy module'],
    ['Simplifier les 14 niveaux de callbacks', 'Flatten 14 levels of callbacks'],
    ['Garder une seule librairie de dates (sur 3)', 'Keep one date library (out of 3)'],
    ['Passer le projet en TypeScript strict', 'Switch the project to strict TypeScript'],
    ['Faire maigrir le bundle de 12 Mo', 'Slim down the 12 MB bundle'],
    ['Remplacer les `setTimeout(0)` magiques', 'Replace the magic `setTimeout(0)`s'],
    ['Fusionner les 5 composants Bouton', 'Merge the 5 Button components'],
    ['Retirer le code mort gardé « au cas où »', 'Remove the "just in case" dead code'],
    ['Une seule langue pour les commentaires', 'One language for code comments'],
    ['Remplacer les regex illisibles', 'Replace the unreadable regexes'],
    ['Découper le composant de 2 000 lignes', 'Split the 2,000-line component'],
    ['Sortir les mots de passe du code', 'Move passwords out of the code'],
    ['Supprimer les `console.log("ici")`', 'Remove the `console.log("here")`s'],
    ['Ranger les migrations SQL en désordre', 'Tidy up the messy SQL migrations'],
  ],
  BUGFIX: [
    ['Le bouton « Payer » paie deux fois', 'The "Pay" button charges twice'],
    ['Les dates en fuseau horaire de Mars', 'Dates showing in Mars time zone'],
    ['Fuite mémoire le mardi', 'Memory leak on Tuesdays'],
    ['Le logo disparaît en mode sombre', 'Logo disappears in dark mode'],
    ['Erreur 500 sur la page 404', 'Error 500 on the 404 page'],
    ['Le mot de passe « 1234 » est refusé, à tort', 'Password "1234" rejected (wrongly)'],
    ['Les emails partent en double, en triple...', 'Emails sent twice, thrice...'],
    ['Crash quand l’utilisateur s’appelle « null »', 'Crash when the user is named "null"'],
    ['La recherche ne trouve que des chats', 'Search only finds cats'],
    ['Off-by-one dans la pagination', 'Off-by-one in pagination'],
    ['Le spinner tourne pour toujours', 'The spinner spins forever'],
    ['Les accents deviennent des losanges', 'Accents turn into diamonds'],
    ['Le bouton disparaît au survol', 'The button vanishes on hover'],
    ['Les notifications arrivent à 3h du matin', 'Notifications arrive at 3 a.m.'],
    ['Le panier se vide tout seul', 'The cart empties itself'],
    ['« Ça marche sur ma machine », pas en prod', '"Works on my machine", not in prod'],
    ['Les photos s’affichent à l’envers sur iPhone', 'Photos show upside down on iPhone'],
    ['Le formulaire refuse les noms composés', 'The form rejects hyphenated names'],
    ['La page met 14 secondes à charger', 'The page takes 14 seconds to load'],
    ['Déconnexions au hasard', 'Random logouts'],
    ['Le total affiche 0,30000000000000004 €', 'The total shows €0.30000000000000004'],
    ['Le mode sombre est clair', 'Dark mode is light'],
    ['La redirection tourne en boucle', 'Infinite redirect loop'],
    ['L’export CSV plante après 1 000 lignes', 'CSV export breaks after 1,000 rows'],
  ],
  INFRA: [
    ['Mettre en place la CI', 'Set up CI'],
    ['Ajouter du monitoring', 'Add monitoring'],
    ['Sauvegardes automatiques de la base', 'Automatic database backups'],
    ['Passer à Kubernetes (pourquoi ?)', 'Move to Kubernetes (why?)'],
    ['Cache Redis', 'Redis cache'],
    ['Auto-scaling des serveurs', 'Server auto-scaling'],
    ['Alerte quand la prod tombe', 'Alert when prod goes down'],
    ['Environnement de staging', 'Staging environment'],
    ['CDN pour les images', 'Image CDN'],
    ['Rotation des logs (le disque est plein)', 'Log rotation (the disk is full)'],
    ['Migrer la base vers une version supportée', 'Migrate the database to a supported version'],
    ['Plan de reprise d’activité', 'Disaster recovery plan'],
    ['Certificat HTTPS expiré (encore)', 'HTTPS certificate expired (again)'],
    ['Réduire la facture du cloud', 'Cut the cloud bill'],
    ['Ranger les secrets dans un coffre-fort', 'Keep the secrets in a vault'],
    ['Tests de charge avant le lancement', 'Load tests before launch'],
    ['Déploiement en un clic', 'One-click deployment'],
    ['File de messages pour les emails', 'Message queue for emails'],
    ['Changer de région cloud', 'Move to another cloud region'],
    ['Limiter le débit de l’API', 'Rate-limit the API'],
    ['Mettre à jour Node (on est en v12)', 'Update Node (we are on v12)'],
    ['Mettre l’app dans des conteneurs', 'Put the app in containers'],
    ['Centraliser les logs', 'Centralise the logs'],
    ['Nettoyer les 40 tâches cron', 'Clean up the 40 cron jobs'],
  ],
};

/** Phases qui débloquent de nouvelles tâches (le garage a déjà le catalogue de base). */
export type GrowthPhase = Extract<Phase, 'SEED' | 'SERIES_A' | 'UNICORN'>;

/**
 * Tâches de startup qui grandit : elles s'ajoutent au catalogue de base à partir de leur
 * phase (et le restent ensuite). Le garage ne parle pas de SSO, la licorne si.
 */
export const GROWTH_TASK_TITLES: Record<
  GrowthPhase,
  Record<TaskType, readonly (readonly [string, string])[]>
> = {
  SEED: {
    FEATURE: [
      ['Page de tarifs', 'Pricing page'],
      ['Programme de bêta privée', 'Private beta programme'],
      ['Tableau de bord du premier client', 'First customer dashboard'],
    ],
    REFACTO: [
      ['Retirer les bricolages du hackathon', 'Remove the hackathon hacks'],
      ['Remplacer le prototype par du vrai code', 'Replace the prototype with real code'],
    ],
    BUGFIX: [
      ['Les bugs des premiers clients', 'Bugs reported by the first customers'],
      ['L’email de bienvenue part en spam', 'The welcome email lands in spam'],
    ],
    INFRA: [
      ['Débrancher le serveur sous le bureau', 'Unplug the server under the desk'],
      ['Un vrai nom de domaine', 'A proper domain name'],
    ],
  },
  SERIES_A: {
    FEATURE: [
      ['Rôles et permissions', 'Roles and permissions'],
      ['Application mobile native', 'Native mobile app'],
      ['Boutique d’extensions', 'Plugin marketplace'],
    ],
    REFACTO: [
      ['Découper le monolithe (un peu)', 'Split the monolith (a little)'],
      ['Documenter l’API interne', 'Document the internal API'],
    ],
    BUGFIX: [
      ['Les gros comptes font tomber la recherche', 'Big accounts break search'],
      ['Erreur dans l’export comptable', 'Error in the accounting export'],
    ],
    INFRA: [
      ['Répliquer la base de données', 'Replicate the database'],
      ['Planning d’astreinte', 'On-call rota'],
    ],
  },
  UNICORN: {
    FEATURE: [
      ['Connexion unique pour les grands comptes', 'Single sign-on for enterprise accounts'],
      ['Offre entreprise sur mesure', 'Custom enterprise plan'],
      ['Lancement en Asie', 'Launch in Asia'],
    ],
    REFACTO: [
      ['Grand ménage avant l’introduction en bourse', 'Big clean-up before the IPO'],
      ['Plateforme interne pour 30 équipes', 'Internal platform for 30 teams'],
    ],
    BUGFIX: [
      ['Un bug qui touche 2 millions de personnes', 'A bug hitting 2 million people'],
      ['Les fuseaux horaires de 40 pays', 'Time zones in 40 countries'],
    ],
    INFRA: [
      ['Certification de sécurité SOC 2', 'SOC 2 security certification'],
      ['Deux clouds, au cas où', 'Two clouds, just in case'],
      ['Audit de sécurité externe', 'External security audit'],
    ],
  },
};

/**
 * Tâches de saison : une par type et par période du calendrier. Pendant la période, une
 * tâche de code sur trois environ prend le titre de saison de son type.
 */
export const SEASON_TASK_TITLES: Record<DecorTheme, Record<TaskType, readonly [string, string]>> = {
  NEW_YEAR: {
    FEATURE: ['Le récap de l’année des utilisateurs', 'Year-in-review for users'],
    REFACTO: ['Ménage de début d’année dans le dépôt', 'New Year clean-up of the repo'],
    BUGFIX: ['L’année écrite en dur dans le pied de page', 'The hard-coded year in the footer'],
    INFRA: ['Tenir le pic de vœux à minuit', 'Survive the midnight greetings spike'],
  },
  VALENTINE: {
    FEATURE: ['Offre duo de la Saint-Valentin', 'Valentine’s two-for-one offer'],
    REFACTO: [
      'Démêler les dépendances circulaires (c’est compliqué)',
      'Untangle circular dependencies (it’s complicated)',
    ],
    BUGFIX: ['Les cœurs s’affichent en carrés', 'Hearts show up as squares'],
    INFRA: ['Tenir la charge du 14 février', 'Handle the February 14 traffic'],
  },
  EASTER: {
    FEATURE: ['Chasse aux œufs cachés dans l’app', 'Hidden egg hunt in the app'],
    REFACTO: ['Retirer les œufs cachés des stagiaires', 'Remove the interns’ hidden eggs'],
    BUGFIX: ['Le lundi de Pâques casse le planning', 'Easter Monday breaks the schedule'],
    INFRA: ['Week-end de Pâques : qui est d’astreinte ?', 'Easter weekend: who is on call?'],
  },
  SPACE: {
    FEATURE: ['Mode « fusée » pour les envois', '"Rocket" mode for uploads'],
    REFACTO: ['Renommer les serveurs aux noms de planètes', 'Rename the planet-named servers'],
    BUGFIX: ['Les positions GPS tombent sur la Lune', 'GPS positions land on the Moon'],
    INFRA: ['Réduire la latence (pas jusqu’à Mars)', 'Cut latency (not all the way to Mars)'],
  },
  MEDIEVAL: {
    FEATURE: ['Rangs des membres : écuyer, chevalier, roi', 'Member ranks: squire, knight, king'],
    REFACTO: ['Moderniser le code d’un autre âge', 'Modernise the code from another age'],
    BUGFIX: ['Les dates avant 1970 plantent', 'Dates before 1970 crash'],
    INFRA: ['Des douves autour du serveur (un pare-feu)', 'A moat around the server (a firewall)'],
  },
  SUPERHEROES: {
    FEATURE: ['Des profils avec super-pouvoirs', 'Profiles with superpowers'],
    REFACTO: ['Sauver le code legacy (sans cape)', 'Rescue the legacy code (no cape)'],
    BUGFIX: ['Le bouton « Sauver » ne sauve rien', 'The "Save" button saves nothing'],
    INFRA: ['Un signal lumineux quand la prod tombe', 'A sky signal when prod goes down'],
  },
  RETRO_80S: {
    FEATURE: ['Thème rétro en pixels', 'Retro pixel theme'],
    REFACTO: ['Retirer le COBOL du grenier', 'Remove the COBOL from the attic'],
    BUGFIX: ['Le son 8 bits ne s’arrête plus', 'The 8-bit sound won’t stop'],
    INFRA: ['Sauvegardes sur cassette (non)', 'Backups on cassette (no)'],
  },
  SUMMER: {
    FEATURE: ['Mode « vacances » des notifications', '"Holiday" mode for notifications'],
    REFACTO: ['Finir le refacto avant les congés', 'Finish the refactor before the holidays'],
    BUGFIX: ['Écran illisible en plein soleil', 'Screen unreadable in full sun'],
    INFRA: ['La clim de la salle serveur', 'The server room air conditioning'],
  },
  PIRATES: {
    FEATURE: ['Langue « pirate » dans les réglages', '"Pirate" language in settings'],
    REFACTO: ['Jeter le code copié des forums', 'Throw out the code copied from forums'],
    BUGFIX: ['Un robot pille nos formulaires', 'A bot is raiding our forms'],
    INFRA: ['Bloquer les aspirateurs de données', 'Block the data scrapers'],
  },
  HALLOWEEN: {
    FEATURE: ['Thème citrouille pour le 31', 'Pumpkin theme for the 31st'],
    REFACTO: ['Exorciser le code zombie', 'Exorcise the zombie code'],
    BUGFIX: ['Le processus fantôme qui revient', 'The ghost process that keeps coming back'],
    INFRA: ['Éteindre les serveurs zombies', 'Shut down the zombie servers'],
  },
  CYBERPUNK: {
    FEATURE: ['Interface néon en option', 'Optional neon interface'],
    REFACTO: ['Débrancher le microservice de trop', 'Unplug one microservice too many'],
    BUGFIX: ['L’écran clignote en rose fluo', 'The screen flickers neon pink'],
    INFRA: ['Tout chiffrer, partout', 'Encrypt everything, everywhere'],
  },
  CHRISTMAS: {
    FEATURE: ['Calendrier de l’Avent dans l’app', 'Advent calendar in the app'],
    REFACTO: ['Geler le code avant Noël', 'Freeze the code before Christmas'],
    BUGFIX: ['La neige animée fait ramer l’app', 'The animated snow makes the app lag'],
    INFRA: ['Tenir les commandes de Noël', 'Survive the Christmas orders'],
  },
};

/** Tailles possibles (suite de Fibonacci) et leur probabilité relative. */
export const TASK_SIZES = [
  { size: 1, weight: 2 },
  { size: 2, weight: 4 },
  { size: 3, weight: 5 },
  { size: 5, weight: 4 },
  { size: 8, weight: 2 },
  { size: 13, weight: 1 },
] as const;

/** Répartition des types dans le backlog généré. */
export const TASK_TYPE_WEIGHTS: Record<TaskType, number> = {
  FEATURE: 5,
  REFACTO: 2,
  BUGFIX: 2,
  INFRA: 1,
};

/** Une tâche hors code : son titre [français, anglais] et son type (effet sur les jauges). */
export interface TradeTaskTemplate {
  readonly title: readonly [string, string];
  readonly type: TaskType;
}

/**
 * Tâches de la designeuse : maquettes (features), pixels à remettre d'aplomb (bugfix) et
 * ménage dans les maquettes (refacto). Peu de features : sinon l'équipe livre trop vite.
 */
export const DESIGN_TASKS: readonly TradeTaskTemplate[] = [
  { title: ['Maquette de la page d’accueil', 'Landing page mockup'], type: 'FEATURE' },
  { title: ['Refaire le logo (version 14)', 'Redo the logo (version 14)'], type: 'REFACTO' },
  { title: ['Parcours d’inscription en Figma', 'Sign-up flow in Figma'], type: 'FEATURE' },
  {
    title: ['Design system : 48 nuances de gris', 'Design system: 48 shades of grey'],
    type: 'REFACTO',
  },
  { title: ['Illustrations pour les pages vides', 'Empty state illustrations'], type: 'FEATURE' },
  { title: ['Ranger les 300 calques Figma', 'Tidy up the 300 Figma layers'], type: 'REFACTO' },
  { title: ['Tests utilisateurs avec post-it', 'User testing with sticky notes'], type: 'FEATURE' },
  { title: ['Le padding est faux de 2 px', 'The padding is off by 2px'], type: 'BUGFIX' },
  {
    title: ['Contraste illisible du bouton gris', 'Unreadable grey button contrast'],
    type: 'BUGFIX',
  },
  { title: ['Le menu déborde sur mobile', 'Menu overflows on mobile'], type: 'BUGFIX' },
  { title: ['Trois polices sur la même page', 'Three fonts on the same page'], type: 'BUGFIX' },
];

/**
 * Tâches du Product Owner : specs et recherche (features), tri des tickets (bugfix) et
 * ménage dans le backlog (refacto).
 */
export const PRODUCT_TASKS: readonly TradeTaskTemplate[] = [
  { title: ['Rédiger les specs du paiement', 'Write the payment specs'], type: 'FEATURE' },
  { title: ['Roadmap à 5 ans (en 3 slides)', '5-year roadmap (in 3 slides)'], type: 'FEATURE' },
  { title: ['Interviewer 10 utilisateurs', 'Interview 10 users'], type: 'FEATURE' },
  {
    title: ['Nettoyer le backlog (412 idées)', 'Clean up the backlog (412 ideas)'],
    type: 'REFACTO',
  },
  { title: ['Écrire les user stories', 'Write the user stories'], type: 'FEATURE' },
  { title: ['Benchmark des concurrents', 'Competitor benchmark'], type: 'BUGFIX' },
  { title: ['Supprimer les specs contradictoires', 'Delete contradicting specs'], type: 'REFACTO' },
  { title: ['Trier les 212 tickets du support', 'Triage the 212 support tickets'], type: 'BUGFIX' },
  {
    title: ['Reproduire le bug « ça marche pas »', 'Reproduce the "it doesn’t work" bug'],
    type: 'BUGFIX',
  },
  { title: ['Répondre aux avis 1 étoile', 'Reply to 1-star reviews'], type: 'BUGFIX' },
];

/** Titres en plus des modèles, pour un métier hors code : seuls les types qu'il tire. */
export type TradeTitles = Partial<Record<TaskType, readonly (readonly [string, string])[]>>;

/**
 * Titres de rechange de la designeuse. Le type reste tiré dans `DESIGN_TASKS` (même
 * répartition qu'avant) ; le titre vient ensuite de tous les titres de ce type.
 */
export const DESIGN_EXTRA_TITLES: TradeTitles = {
  FEATURE: [
    ['Des icônes maison pour toute l’app', 'Custom icons for the whole app'],
    ['Maquette de l’appli mobile', 'Mobile app mockup'],
    ['Des pages d’erreur rigolotes', 'Funny error pages'],
    ['Animation du bouton « J’aime »', '"Like" button animation'],
    ['Charte graphique de 60 pages', '60-page brand guidelines'],
  ],
  REFACTO: [
    ['Renommer « Copie de copie de final v2 »', 'Rename "Copy of copy of final v2"'],
    ['Les mêmes arrondis sur tous les boutons', 'The same corner radius on every button'],
    ['Remplacer les photos de banque d’images', 'Replace the stock photos'],
  ],
  BUGFIX: [
    ['Texte blanc sur fond jaune', 'White text on a yellow background'],
    ['Icônes floues sur les écrans haute définition', 'Blurry icons on high-density screens'],
    ['Le bouton est 3 px trop à gauche', 'The button is 3px too far left'],
    ['Le site casse avec un zoom à 200 %', 'The site breaks at 200% zoom'],
  ],
};

/** Titres de rechange du Product Owner (même principe que la designeuse). */
export const PRODUCT_EXTRA_TITLES: TradeTitles = {
  FEATURE: [
    ['Inventer le persona « Jean-Michel, 45 ans »', 'Invent the persona "Gary, 45"'],
    ['Test A/B sur la couleur du bouton', 'A/B test on the button colour'],
    ['Préparer la démo du sprint', 'Prepare the sprint demo'],
    ['Rédiger le communiqué de lancement', 'Write the launch press release'],
    ['Objectifs du trimestre (version 3)', 'Quarterly goals (version 3)'],
  ],
  REFACTO: [
    ['Fusionner les 3 roadmaps', 'Merge the 3 roadmaps'],
    ['Archiver les tickets de 2022', 'Archive the 2022 tickets'],
    ['Réécrire les critères d’acceptation flous', 'Rewrite the vague acceptance criteria'],
  ],
  BUGFIX: [
    ['Comprendre pourquoi les gens se désabonnent', 'Find out why people unsubscribe'],
    ['Préciser le ticket « faire marcher le truc »', 'Clarify the ticket "make the thing work"'],
    ['Calmer le client qui écrit en majuscules', 'Calm down the ALL-CAPS customer'],
    ['Retrouver la spec perdue dans le wiki', 'Find the spec lost in the wiki'],
  ],
};
