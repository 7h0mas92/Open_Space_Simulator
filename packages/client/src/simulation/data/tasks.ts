import type { TaskType } from '@oss/shared';

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
  ],
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

/** Tâches de la designeuse : maquettes (features) et pixels à remettre d'aplomb (bugfix). */
export const DESIGN_TASKS: readonly TradeTaskTemplate[] = [
  { title: ['Maquette de la page d’accueil', 'Landing page mockup'], type: 'FEATURE' },
  { title: ['Refaire le logo (version 14)', 'Redo the logo (version 14)'], type: 'FEATURE' },
  { title: ['Parcours d’inscription en Figma', 'Sign-up flow in Figma'], type: 'FEATURE' },
  {
    title: ['Design system : 48 nuances de gris', 'Design system: 48 shades of grey'],
    type: 'FEATURE',
  },
  { title: ['Illustrations pour les pages vides', 'Empty state illustrations'], type: 'FEATURE' },
  { title: ['Icônes du mode sombre', 'Dark mode icons'], type: 'FEATURE' },
  { title: ['Tests utilisateurs avec post-it', 'User testing with sticky notes'], type: 'FEATURE' },
  { title: ['Le padding est faux de 2 px', 'The padding is off by 2px'], type: 'BUGFIX' },
  {
    title: ['Contraste illisible du bouton gris', 'Unreadable grey button contrast'],
    type: 'BUGFIX',
  },
  { title: ['Le menu déborde sur mobile', 'Menu overflows on mobile'], type: 'BUGFIX' },
  { title: ['Trois polices sur la même page', 'Three fonts on the same page'], type: 'BUGFIX' },
];

/** Tâches du Product Owner : specs et recherche (features), tri des tickets (bugfix). */
export const PRODUCT_TASKS: readonly TradeTaskTemplate[] = [
  { title: ['Rédiger les specs du paiement', 'Write the payment specs'], type: 'FEATURE' },
  { title: ['Roadmap à 5 ans (en 3 slides)', '5-year roadmap (in 3 slides)'], type: 'FEATURE' },
  { title: ['Interviewer 10 utilisateurs', 'Interview 10 users'], type: 'FEATURE' },
  { title: ['Persona « Martine, 42 ans »', 'Persona "Martine, 42"'], type: 'FEATURE' },
  { title: ['Écrire les user stories', 'Write the user stories'], type: 'FEATURE' },
  { title: ['Benchmark des concurrents', 'Competitor benchmark'], type: 'FEATURE' },
  { title: ['Définir les OKR du trimestre', 'Set this quarter’s OKRs'], type: 'FEATURE' },
  { title: ['Trier les 212 tickets du support', 'Triage the 212 support tickets'], type: 'BUGFIX' },
  {
    title: ['Reproduire le bug « ça marche pas »', 'Reproduce the "it doesn’t work" bug'],
    type: 'BUGFIX',
  },
  { title: ['Répondre aux avis 1 étoile', 'Reply to 1-star reviews'], type: 'BUGFIX' },
];
