import type { TaskType } from '@oss/shared';
import type { GrowthPhase, TradeTitles } from './tasks';

/**
 * Titres de tâches en plus, pour que le Kanban se renouvelle même avec une grande équipe
 * (jusqu'à 3 idées par dev et par sprint, plus le réapprovisionnement en cours de sprint).
 * Ils s'ajoutent aux catalogues de `tasks.ts` et `qaTasks.ts` dans `titlePool` : le titre
 * reste décoratif (ni la taille, ni le type, ni l'effet n'en dépendent).
 */

type Titles = readonly (readonly [string, string])[];

/** Tâches de code, toutes phases. */
export const MORE_TASK_TITLES: Record<TaskType, Titles> = {
  FEATURE: [
    ['Connexion avec un QR code', 'Sign in with a QR code'],
    ['Mode « présentation » plein écran', 'Full-screen "presentation" mode'],
    ['Favoris et listes personnelles', 'Favourites and personal lists'],
    ['Rappels par SMS', 'SMS reminders'],
    ['Tableau de bord pour les admins', 'Admin dashboard'],
    ['Import depuis Google Drive', 'Import from Google Drive'],
    ['Lecture des articles à voix haute', 'Read articles out loud'],
    ['Récapitulatif de l’année façon « Wrapped »', '"Wrapped"-style year in review'],
    ['Mentions @ dans les commentaires', '@mentions in comments'],
    ['Signature électronique des contrats', 'E-signature for contracts'],
    ['Carte interactive des utilisateurs', 'Interactive user map'],
    ['Résumé automatique par IA', 'AI auto-summary'],
    ['Mode invité sans inscription', 'Guest mode without sign-up'],
    ['Partage par lien avec date d’expiration', 'Expiring share links'],
    ['Filtres enregistrés', 'Saved filters'],
    ['Copier-coller d’images dans l’éditeur', 'Paste images into the editor'],
    ['Programme de fidélité à points', 'Points-based loyalty program'],
    ['Factures téléchargeables en PDF', 'Downloadable PDF invoices'],
    ['Statut « en ligne » des collègues', 'Colleagues’ "online" status'],
    ['Réactions animées en confettis', 'Animated confetti reactions'],
    ['Assistant de première configuration', 'First-run setup wizard'],
    ['Corbeille avec restauration sous 30 jours', 'Trash with 30-day restore'],
    ['Accès en lecture seule pour les invités', 'Read-only access for guests'],
    [
      'Commande vocale (qui comprend une fois sur deux)',
      'Voice commands (that work half the time)',
    ],
    ['Comparateur d’offres', 'Plan comparison page'],
  ],
  REFACTO: [
    ['Remplacer les 12 singletons', 'Replace the 12 singletons'],
    ['Découper le contrôleur qui fait tout', 'Split the do-everything controller'],
    ['Supprimer la deuxième API « v2-new »', 'Remove the second "v2-new" API'],
    ['Uniformiser les messages d’erreur', 'Standardise error messages'],
    ['Sortir les constantes magiques', 'Extract the magic numbers'],
    ['Passer les promesses en async/await', 'Turn promises into async/await'],
    ['Supprimer le framework maison', 'Remove the home-made framework'],
    ['Réduire les 9 niveaux de `if` imbriqués', 'Flatten the 9 nested `if`s'],
    ['Renommer les fonctions `doStuff`', 'Rename the `doStuff` functions'],
    ['Factoriser les 4 clients HTTP', 'Merge the 4 HTTP clients'],
    ['Retirer la librairie abandonnée en 2017', 'Drop the library abandoned in 2017'],
    ['Tests unitaires du module de facturation', 'Unit tests for the billing module'],
    ['Remplacer les chaînes par des enums', 'Replace strings with enums'],
    ['Faire passer le linter sans `eslint-disable`', 'Pass the linter without `eslint-disable`'],
    ['Découper la migration de 3 000 lignes', 'Split the 3,000-line migration'],
    ['Supprimer les variables globales', 'Remove the global variables'],
    ['Nettoyer le CSS en `!important`', 'Clean up the `!important` CSS'],
    ['Isoler l’accès à la base de données', 'Isolate database access'],
    [
      'Documenter la fonction que personne n’ose toucher',
      'Document the function nobody dares touch',
    ],
    ['Remplacer les `TODO` de 2020', 'Resolve the 2020 `TODO`s'],
    ['Supprimer les doublons de traductions', 'Remove duplicate translations'],
    ['Simplifier le fichier de config de 800 lignes', 'Simplify the 800-line config file'],
    ['Découper le monorepo dans le monorepo', 'Split the monorepo inside the monorepo'],
    ['Accélérer les tests (40 minutes)', 'Speed up the tests (40 minutes)'],
    ['Retirer les polyfills pour Internet Explorer', 'Remove the Internet Explorer polyfills'],
  ],
  BUGFIX: [
    ['Le bouton « Annuler » valide', 'The "Cancel" button confirms'],
    ['Les vidéos jouent sans le son, puis trop fort', 'Videos play muted, then too loud'],
    ['Le 29 février fait tout planter', 'February 29th crashes everything'],
    ['L’heure d’été décale tous les rendez-vous', 'Daylight saving shifts every meeting'],
    ['Le captcha refuse les humains', 'The captcha rejects humans'],
    ['Les prix s’affichent en yens', 'Prices show in yen'],
    ['La barre de recherche efface ce qu’on tape', 'The search bar erases what you type'],
    ['Les noms de 40 lettres cassent la mise en page', '40-letter names break the layout'],
    ['Le lien « Mot de passe oublié » est cassé', 'The "Forgot password" link is broken'],
    ['Les emojis dans le pseudo cassent la base', 'Emojis in usernames break the database'],
    ['Le scroll remonte tout seul', 'The page scrolls back up by itself'],
    ['Les notifications lues reviennent', 'Read notifications come back'],
    ['L’upload échoue au-dessus de 1 Mo', 'Uploads fail above 1 MB'],
    ['Deux comptes avec le même email', 'Two accounts with the same email'],
    ['Le tri par date trie par ordre alphabétique', 'Sorting by date sorts alphabetically'],
    [
      'Le clavier mobile cache le bouton « Envoyer »',
      'The mobile keyboard hides the "Send" button',
    ],
    ['Le graphique affiche -3 utilisateurs', 'The chart shows -3 users'],
    ['La session expire pendant qu’on tape', 'The session expires while typing'],
    ['Le favicon est celui d’un autre site', 'The favicon belongs to another site'],
    ['Les PDF sortent en page blanche', 'PDFs come out blank'],
    ['Le bouton retour du navigateur déconnecte', 'The browser back button logs you out'],
    ['Les montants négatifs passent au paiement', 'Negative amounts get through checkout'],
    ['La traduction anglaise est en allemand', 'The English translation is in German'],
    ['Les filtres s’annulent entre eux', 'The filters cancel each other out'],
    ['Le mode hors ligne efface les données', 'Offline mode deletes data'],
  ],
  INFRA: [
    ['Alertes sur Slack plutôt que par email', 'Alerts on Slack instead of email'],
    ['Déploiements sans coupure', 'Zero-downtime deployments'],
    ['Base de données en lecture seule pour les stats', 'Read replica for analytics'],
    ['Tableau de bord des temps de réponse', 'Response time dashboard'],
    ['Nettoyer les buckets de stockage publics', 'Clean up public storage buckets'],
    ['Supprimer les 200 branches mortes', 'Delete the 200 dead branches'],
    ['Mettre la CI sous 10 minutes', 'Get CI under 10 minutes'],
    ['Restaurer une sauvegarde pour de vrai', 'Actually restore a backup'],
    ['Feature flags sans redéployer', 'Feature flags without redeploying'],
    ['Page de statut publique', 'Public status page'],
    ['Infrastructure décrite dans du code', 'Infrastructure as code'],
    ['Compresser les images à l’upload', 'Compress images on upload'],
    ['Pare-feu applicatif devant l’API', 'Web application firewall for the API'],
    ['Environnement de recette par branche', 'Preview environment per branch'],
    ['Traçage des requêtes de bout en bout', 'End-to-end request tracing'],
    ['Purger les logs qui contiennent des mots de passe', 'Purge logs that contain passwords'],
    ['Renouvellement automatique des certificats', 'Automatic certificate renewal'],
    ['Limiter les coûts des fonctions serverless', 'Cap the serverless bill'],
    ['Passer les images Docker au régime', 'Put the Docker images on a diet'],
    ['Exercice « la prod a disparu »', '"Prod is gone" drill'],
    ['Index sur la table de 80 millions de lignes', 'Index the 80-million-row table'],
    ['Pool de connexions à la base', 'Database connection pool'],
    ['Mises à jour de sécurité automatiques', 'Automatic security updates'],
    ['Quotas par client sur l’API', 'Per-customer API quotas'],
    ['Vider le cache sans tout casser', 'Clear the cache without breaking everything'],
  ],
};

/** Tâches de code débloquées par la phase, en plus de `GROWTH_TASK_TITLES`. */
export const MORE_GROWTH_TITLES: Record<GrowthPhase, Record<TaskType, Titles>> = {
  SEED: {
    FEATURE: [
      ['Espace client pour les premiers abonnés', 'Customer area for the first subscribers'],
      ['Essai gratuit de 14 jours', '14-day free trial'],
      ['Codes promo pour le lancement', 'Launch promo codes'],
    ],
    REFACTO: [
      ['Effacer le code du prototype de la levée', 'Delete the fundraising prototype code'],
      ['Séparer le front du back', 'Split front end from back end'],
      ['Premiers tests de bout en bout', 'First end-to-end tests'],
    ],
    BUGFIX: [
      ['Le premier vrai client ne reçoit pas son email', 'The first real customer gets no email'],
      ['L’inscription plante avec un « + » dans l’email', 'Sign-up fails with a "+" in the email'],
      ['Le paiement de test part en vrai', 'The test payment went through for real'],
    ],
    INFRA: [
      ['Sortir du serveur sous le bureau', 'Move off the server under the desk'],
      ['Nom de domaine sans « -app-final »', 'A domain name without "-app-final"'],
      ['Premières alertes de la prod', 'First prod alerts'],
    ],
  },
  SERIES_A: {
    FEATURE: [
      ['Espaces d’équipe avec rôles', 'Team workspaces with roles'],
      ['Journal d’audit pour les entreprises', 'Audit log for enterprises'],
      ['Marque blanche pour les revendeurs', 'White label for resellers'],
    ],
    REFACTO: [
      ['Découper le monolithe (une partie)', 'Split the monolith (part of it)'],
      ['Contrat d’API versionné', 'Versioned API contract'],
      ['Bibliothèque de composants partagée', 'Shared component library'],
    ],
    BUGFIX: [
      ['Les grosses équipes dépassent la limite de 100', 'Big teams exceed the 100 limit'],
      ['La facture annuelle compte 13 mois', 'The yearly invoice counts 13 months'],
      ['Les exports des gros clients expirent', 'Big customers’ exports time out'],
    ],
    INFRA: [
      ['Deuxième région de secours', 'Second failover region'],
      ['Astreinte organisée (avec planning)', 'Organised on-call (with a rota)'],
      ['Test d’intrusion par des hackers éthiques', 'Penetration test by ethical hackers'],
    ],
  },
  UNICORN: {
    FEATURE: [
      ['Place de marché d’extensions', 'Extension marketplace'],
      ['Offre pour les gouvernements', 'Government edition'],
      ['Assistant IA dans chaque écran', 'AI assistant on every screen'],
    ],
    REFACTO: [
      ['Plateforme interne pour les 30 équipes', 'Internal platform for the 30 teams'],
      ['Supprimer les 6 systèmes de permissions', 'Remove the 6 permission systems'],
      ['Migration de la base sans arrêt', 'Zero-downtime database migration'],
    ],
    BUGFIX: [
      ['La panne d’un datacenter coupe tout le monde', 'One datacenter outage cuts everyone off'],
      ['Les fuseaux horaires de 140 pays', 'Time zones across 140 countries'],
      ['Le classement mondial compte en double', 'The global leaderboard double counts'],
    ],
    INFRA: [
      ['Datacenters sur 3 continents', 'Datacenters on 3 continents'],
      ['Certification sécurité pour la Bourse', 'Security certification for the IPO'],
      ['Facture cloud à 9 chiffres à réduire', 'Cut the 9-figure cloud bill'],
    ],
  },
};

/** Titres en plus pour la designeuse. */
export const MORE_DESIGN_TITLES: TradeTitles = {
  FEATURE: [
    ['Maquette du tableau de bord', 'Dashboard mockup'],
    ['Onboarding illustré en 3 écrans', 'Illustrated 3-screen onboarding'],
    ['Mode sombre dans Figma d’abord', 'Dark mode in Figma first'],
    ['Prototype cliquable pour la démo', 'Clickable prototype for the demo'],
    ['Mascotte de l’app (version 1)', 'App mascot (version 1)'],
    ['Micro-animations des boutons', 'Button micro-animations'],
    ['Page de tarifs qui donne envie', 'A pricing page that sells'],
    ['Emails transactionnels jolis', 'Pretty transactional emails'],
  ],
  REFACTO: [
    ['Une seule palette de couleurs', 'One colour palette'],
    ['Nommer les composants Figma comme le code', 'Name Figma components like the code'],
    ['Supprimer les 14 variantes du bouton', 'Delete the 14 button variants'],
    ['Grille de 8 px partout', 'An 8px grid everywhere'],
    ['Bibliothèque d’icônes à jour', 'Up-to-date icon library'],
    ['Documenter les espacements', 'Document the spacing'],
  ],
  BUGFIX: [
    ['Les textes débordent en allemand', 'Text overflows in German'],
    ['Le focus clavier est invisible', 'Keyboard focus is invisible'],
    ['Les images sont déformées sur tablette', 'Images are stretched on tablets'],
    ['Le bouton principal est gris', 'The primary button is grey'],
    ['Les tableaux sont illisibles sur mobile', 'Tables are unreadable on mobile'],
    ['Deux tailles de titre pour le même niveau', 'Two heading sizes for the same level'],
  ],
};

/** Titres en plus pour le Product Owner. */
export const MORE_PRODUCT_TITLES: TradeTitles = {
  FEATURE: [
    ['Définir le MVP (vraiment minimal)', 'Define the MVP (actually minimal)'],
    ['Carte des parcours utilisateurs', 'User journey map'],
    ['Plan de lancement sur Product Hunt', 'Product Hunt launch plan'],
    ['Questionnaire de satisfaction', 'Satisfaction survey'],
    ['Prioriser avec la méthode MoSCoW', 'Prioritise with MoSCoW'],
    ['Tarifs à tester avec 5 clients', 'Pricing to test with 5 customers'],
    ['Préparer le comité produit', 'Prepare the product committee'],
    ['Spécifier les droits d’accès', 'Specify access rights'],
  ],
  REFACTO: [
    ['Découper l’épopée de 80 points', 'Split the 80-point epic'],
    ['Fermer les tickets « à discuter »', 'Close the "to be discussed" tickets'],
    ['Mettre à jour la roadmap publique', 'Update the public roadmap'],
    ['Un seul outil de tickets (sur 3)', 'One ticket tool (out of 3)'],
    ['Glossaire produit pour tout le monde', 'Product glossary for everyone'],
    ['Supprimer les fonctionnalités que personne n’utilise', 'Remove features nobody uses'],
  ],
  BUGFIX: [
    ['Comprendre la chute des inscriptions', 'Understand the sign-up drop'],
    ['Répondre au client qui menace de partir', 'Answer the customer threatening to leave'],
    ['Lire les 300 retours du sondage', 'Read the 300 survey answers'],
    ['Reproduire le bug du gros client', 'Reproduce the big customer’s bug'],
    ['Trouver qui a promis cette fonctionnalité', 'Find out who promised this feature'],
    ['Expliquer pourquoi le délai a doublé', 'Explain why the deadline doubled'],
  ],
};

/** Titres en plus pour les testeurs (jamais de feature). */
export const MORE_QA_TITLES: TradeTitles = {
  BUGFIX: [
    ['Tester avec une connexion 3G', 'Test on a 3G connection'],
    ['Tester le parcours d’achat de bout en bout', 'Test the checkout end to end'],
    ['Coller un roman dans le champ « Nom »', 'Paste a novel into the "Name" field'],
    ['Tester avec le lecteur d’écran', 'Test with a screen reader'],
    ['Tester le changement d’heure', 'Test the daylight saving switch'],
    ['Cliquer 50 fois sur « Payer »', 'Click "Pay" 50 times'],
    ['Tester en arabe (de droite à gauche)', 'Test in Arabic (right to left)'],
  ],
  REFACTO: [
    ['Automatiser le test du paiement', 'Automate the checkout test'],
    ['Supprimer les tests qui ne testent rien', 'Delete tests that test nothing'],
    ['Jeu de données de test réaliste', 'Realistic test data set'],
    ['Tests de captures d’écran', 'Screenshot tests'],
    ['Plan de test de la prochaine release', 'Test plan for the next release'],
  ],
  INFRA: [
    ['Ferme de téléphones de test', 'Test phone farm'],
    ['Base de test remise à zéro chaque nuit', 'Test database reset every night'],
    ['Lancer les tests sur 4 navigateurs', 'Run tests on 4 browsers'],
    ['Rapport de tests lisible par le PO', 'Test report the PO can read'],
  ],
};
