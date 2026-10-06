import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/** Cartes « technique » : prod, dette, architecture, outils. */
export const TECH_CARDS: EventCard[] = [
  card({
    id: 'cto-medium-microservices',
    title: t('Le CTO a lu un article sur Medium', 'The CTO read an article on Medium'),
    description: t(
      '« Netflix le fait, donc on doit passer en microservices. » Vous avez 3 utilisateurs actifs.',
      '"Netflix does it, so we must move to microservices." You have 3 active users.',
    ),
    conditions: { minPhase: 'GARAGE' },
    weight: 8,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Migrer en microservices', 'Migrate to microservices'),
        effects: { sprintsLost: 1, hype: 10, stability: -10, debt: -5 },
      },
      {
        label: t('Proposer un « monolithe modulaire »', 'Suggest a "modular monolith"'),
        effects: { debt: -3, 'moral.SENIOR_BEARD': 10, hype: -2 },
      },
      { label: LATER, effects: { requeue: { cardId: 'cto-medium-kubernetes', delaySprints: 2 } } },
    ],
  }),
  card({
    id: 'cto-medium-kubernetes',
    title: t('Le CTO a lu un DEUXIÈME article', 'The CTO read a SECOND article'),
    description: t(
      'Cette fois c’est Kubernetes, un service mesh et de l’event sourcing. Les stickers sont déjà commandés.',
      "This time it's Kubernetes, a service mesh and event sourcing. The stickers are already ordered.",
    ),
    conditions: { requiresSeen: 'cto-medium-microservices' },
    weight: 0,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Tout migrer, on n’a qu’une vie', 'Migrate everything, YOLO'),
        effects: { sprintsLost: 2, hype: 15, stability: -20, treasury: -40000 },
      },
      {
        label: t(
          'Offrir au CTO un abonnement à un autre blog',
          'Buy them a subscription to another blog',
        ),
        effects: { treasury: -500, moral: -6, debt: 4, hype: -4 },
      },
    ],
  }),
  card({
    id: 'friday-prod-down',
    title: t('Vendredi 17h04, la prod est down', 'Friday 5:04pm, prod is down'),
    description: t(
      'Quelqu’un a déployé « juste un petit fix ». Les alertes sonnent, les sacs sont déjà sur l’épaule.',
      'Someone deployed "just a tiny fix". Alerts are firing, bags are already on shoulders.',
    ),
    conditions: { dayOfWeek: 5, afterHour: 17 },
    weight: 6,
    cooldownSprints: 1,
    choices: [
      {
        label: t('Tout le monde reste jusqu’à minuit', 'Everyone stays until midnight'),
        effects: { stability: 10, moral: -10 },
      },
      {
        label: t('Rollback et on rentre', 'Roll back and go home'),
        effects: { stability: 5, hype: -3, debt: 3 },
      },
      {
        label: t('Personne n’a rien vu', 'Nobody saw anything'),
        effects: { stability: -10, users: -5, unlockAchievement: 'this-is-fine' },
      },
    ],
  }),
  card({
    id: 'intern-force-push',
    title: t('Le stagiaire a git push --force sur main', "The intern git push --force'd to main"),
    description: t(
      'Trois jours de travail ont disparu. Explication du stagiaire : « Git l’a demandé ».',
      'Three days of work are gone. The intern says "Git asked for it".',
    ),
    conditions: { hasRole: 'INTERN' },
    weight: 10,
    cooldownSprints: 3,
    choices: [
      {
        label: t(
          'Restaurer depuis le reflog (le Senior sait faire)',
          'Restore from the reflog (the Senior knows how)',
        ),
        effects: { stability: -3, 'moral.SENIOR_BEARD': -5, 'moral.INTERN': 5 },
      },
      {
        label: t('Protéger la branche main, enfin', 'Protect the main branch, finally'),
        effects: { debt: -3, stability: 3, moral: -2 },
      },
      {
        label: t('Afficher sa photo à la machine à café', 'Pin their photo by the coffee machine'),
        effects: { 'moral.INTERN': -20, moral: 4 },
      },
    ],
  }),
  card({
    id: 'rubber-duck',
    title: t(
      'Un canard en plastique a été trouvé sur un bureau',
      'A rubber duck was found on a desk',
    ),
    description: t(
      'Depuis son arrivée, les bugs se résolvent tout seuls. Le canard ne dit rien. Il écoute.',
      'Since it arrived, bugs fix themselves. The duck says nothing. It listens.',
    ),
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Acheter un canard à chaque dev', 'Buy a duck for every dev'),
        effects: { treasury: -300, stability: 5, moral: 5 },
      },
      {
        label: t('Le nommer Lead Developer', 'Promote it to Lead Developer'),
        effects: { hype: 4, moral: 3, unlockAchievement: 'duck-lead' },
      },
      {
        label: t('Le jeter, on est des pros', 'Throw it away, we are professionals'),
        effects: { stability: -5, moral: -5 },
      },
    ],
  }),
  card({
    id: 'npm-left-pad',
    title: t(
      'Une dépendance de 11 lignes a disparu de npm',
      'An 11-line dependency vanished from npm',
    ),
    description: t(
      'Plus rien ne compile. Personne ne savait qu’on dépendait de « is-even ».',
      'Nothing builds anymore. Nobody knew we depended on "is-even".',
    ),
    weight: 7,
    choices: [
      {
        label: t('La réécrire nous-mêmes (11 lignes)', 'Rewrite it ourselves (11 lines)'),
        effects: { debt: -2, stability: 2, moral: 2 },
      },
      {
        label: t('Figer toutes les versions pour toujours', 'Pin every version forever'),
        effects: { debt: 6, stability: 4 },
      },
    ],
  }),
  card({
    id: 'works-on-my-machine',
    title: t('« Ça marche sur ma machine »', '"It works on my machine"'),
    description: t(
      'La feature marche chez le dev, pas en prod. La solution évidente : livrer sa machine.',
      "The feature works on the dev's laptop, not in prod. Obvious fix: ship the laptop.",
    ),
    weight: 8,
    choices: [
      {
        label: t('Mettre en place Docker', 'Set up Docker'),
        effects: { treasury: -2000, debt: -4, stability: 5, moral: -3 },
      },
      {
        label: t('Envoyer le laptop au datacenter', 'Ship the laptop to the datacenter'),
        effects: { stability: 3, debt: 6, hype: 2 },
      },
    ],
  }),
  card({
    id: 'database-no-backup',
    title: t('Les sauvegardes n’ont jamais marché', 'Backups never worked'),
    description: t(
      'En testant une restauration, vous découvrez que le script sauvegarde... le script.',
      'While testing a restore, you discover the backup script backs up... the script.',
    ),
    conditions: { gauges: { stability: { max: 70 } } },
    weight: 6,
    choices: [
      {
        label: t('Tout arrêter et corriger', 'Stop everything and fix it'),
        effects: { sprintsLost: 1, stability: 20, debt: -5 },
      },
      {
        label: t('Croiser les doigts', 'Cross fingers'),
        effects: { stability: -5, requeue: { cardId: 'database-deleted', delaySprints: 2 } },
      },
    ],
  }),
  card({
    id: 'database-deleted',
    title: t('La base de prod a été supprimée', 'The production database was deleted'),
    description: t(
      'Quelqu’un a lancé le script de test sur la mauvaise base. Et les sauvegardes, comme vous le savez...',
      'Someone ran the test script on the wrong database. And the backups, as you know...',
    ),
    conditions: { requiresSeen: 'database-no-backup' },
    weight: 0,
    cooldownSprints: 20,
    choices: [
      {
        label: t('Tout reconstruire à partir des logs', 'Rebuild everything from logs'),
        effects: { sprintsLost: 1, users: -20, stability: 10, moral: -10 },
      },
      {
        label: t('Faire un post « on a été hackés »', 'Post "we were hacked"'),
        effects: { users: -30, hype: -15, unlockAchievement: 'bobby-tables' },
      },
    ],
  }),
  card({
    id: 'regex-email',
    title: t('Une regex de validation d’email', 'An email validation regex'),
    description: t(
      'Elle fait 400 caractères, rejette les .fr et accepte « 🍕@🍕 ». Personne n’ose y toucher.',
      'It is 400 characters long, rejects .fr and accepts "🍕@🍕". Nobody dares touch it.',
    ),
    weight: 7,
    choices: [
      {
        label: t('La remplacer par une lib', 'Replace it with a library'),
        effects: { debt: -3, users: 2, treasury: -1500, moral: -2 },
      },
      {
        label: t('Ajouter un commentaire « ne pas toucher »', 'Add a "do not touch" comment'),
        effects: { debt: 3 },
      },
      {
        label: t('L’étendre pour accepter les emojis', 'Extend it to accept emojis'),
        effects: { hype: 3, debt: 5, users: 1 },
      },
    ],
  }),
  card({
    id: 'leaked-api-key',
    title: t('Une clé d’API a fuité sur GitHub', 'An API key leaked on GitHub'),
    description: t(
      'Des bots minent de la crypto avec votre compte cloud. La facture monte en temps réel.',
      'Bots are mining crypto on your cloud account. The bill is going up in real time.',
    ),
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Révoquer et faire une formation sécurité', 'Revoke it and run security training'),
        effects: { treasury: -8000, moral: -4, stability: 4 },
      },
      {
        label: t('Révoquer en silence', 'Revoke it quietly'),
        effects: { treasury: -15000, debt: 2 },
      },
    ],
  }),
  card({
    id: 'it-is-dns',
    title: t('Ce n’est pas le DNS. Si, c’est le DNS.', "It's not DNS. It's DNS."),
    description: t(
      'Le site est injoignable depuis 2h. Après 14 hypothèses, c’était le DNS. C’est toujours le DNS.',
      'The site has been down for 2h. After 14 hypotheses, it was DNS. It is always DNS.',
    ),
    weight: 7,
    choices: [
      {
        label: t('Mettre du monitoring partout', 'Add monitoring everywhere'),
        effects: { treasury: -3000, stability: 6 },
      },
      {
        label: t('Imprimer « C’EST LE DNS » sur un poster', 'Print an "IT\'S DNS" poster'),
        effects: { moral: 4, stability: -2 },
      },
    ],
  }),
  card({
    id: 'legacy-php',
    title: t('Le module de facturation est en PHP 5', 'The billing module runs on PHP 5'),
    description: t(
      'Il a été écrit en 2009 par un freelance dont on n’a que le prénom : « Jean-Mi ».',
      'It was written in 2009 by a freelancer known only as "Jean-Mi".',
    ),
    weight: 6,
    choices: [
      { label: t('Le réécrire', 'Rewrite it'), effects: { sprintsLost: 1, debt: -12 } },
      {
        label: t('Ne surtout pas y toucher', 'Never, ever touch it'),
        effects: { debt: 4, 'moral.SENIOR_BEARD': 5 },
      },
      { label: LATER, effects: { requeue: { delaySprints: 2 } } },
    ],
  }),
  card({
    id: 'tests-flaky',
    title: t('Les tests échouent un jour sur deux', 'Tests fail every other day'),
    description: t(
      'La CI est rouge, puis verte, puis rouge. L’équipe relance jusqu’à ce que ça passe.',
      'CI is red, then green, then red. The team re-runs until it passes.',
    ),
    conditions: { gauges: { debt: { min: 30 } } },
    weight: 8,
    choices: [
      {
        label: t('Chasser les tests instables', 'Hunt down the flaky tests'),
        effects: { debt: -6, moral: -3, hype: -2 },
      },
      {
        label: t('Désactiver les tests', 'Disable the tests'),
        effects: { debt: 8, moral: 3, stability: -4 },
      },
    ],
  }),
  card({
    id: 'ai-code-review',
    title: t('L’IA fait les code reviews', 'AI does the code reviews'),
    description: t(
      'Elle approuve tout avec « LGTM 🚀 », y compris un fichier qui supprime la base.',
      'It approves everything with "LGTM 🚀", including a file that drops the database.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    choices: [
      {
        label: t('Garder une review humaine', 'Keep a human review'),
        effects: { debt: -3, moral: -2 },
      },
      { label: t('Tout automatiser', 'Automate everything'), effects: { debt: 6, hype: 4 } },
    ],
  }),
  card({
    id: 'cloud-bill',
    title: t('La facture cloud a triplé', 'The cloud bill tripled'),
    description: t(
      'Un environnement de test tourne depuis 6 mois avec 64 GPU. Personne ne sait pourquoi.',
      'A test environment has been running for 6 months on 64 GPUs. Nobody knows why.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 7,
    choices: [
      {
        label: t('Tout éteindre', 'Shut it all down'),
        effects: { treasury: -20000, stability: -4 },
      },
      {
        label: t('Embaucher un FinOps', 'Hire a FinOps'),
        effects: { treasury: -35000, debt: -3, stability: 3 },
      },
      {
        label: t('L’appeler « notre infra IA »', 'Call it "our AI infrastructure"'),
        effects: { treasury: -30000, hype: 8 },
      },
    ],
  }),
  card({
    id: 'framework-of-the-week',
    title: t('Un nouveau framework JS est sorti', 'A new JS framework came out'),
    description: t(
      'Il est sorti hier, il a 40 000 étoiles et il réinvente le bouton.',
      'It came out yesterday, has 40,000 stars and reinvents the button.',
    ),
    weight: 8,
    cooldownSprints: 3,
    choices: [
      {
        label: t('Tout migrer dessus', 'Migrate everything'),
        effects: { hype: 6, debt: 8, 'moral.SENIOR_BEARD': -15, 'moral.TEN_X': 10 },
      },
      {
        label: t('Attendre 5 ans', 'Wait 5 years'),
        effects: { 'moral.SENIOR_BEARD': 10, 'moral.TEN_X': -8, hype: -2 },
      },
    ],
  }),
  card({
    id: 'rewrite-in-rust',
    title: t('« Et si on réécrivait tout en Rust ? »', '"What if we rewrote everything in Rust?"'),
    description: t(
      'Le Rustacé a préparé 47 slides. La slide 3 s’intitule « Pourquoi vous avez tort ».',
      'The Rustacean prepared 47 slides. Slide 3 is titled "Why you are wrong".',
    ),
    conditions: { hasRole: 'RUSTACEAN' },
    weight: 9,
    cooldownSprints: 5,
    choices: [
      {
        label: t('Oui, blazingly fast !', 'Yes, blazingly fast!'),
        effects: { sprintsLost: 1, debt: -15, stability: 8, 'moral.RUSTACEAN': 20 },
      },
      {
        label: t('Juste un microservice', 'Just one microservice'),
        effects: { debt: -4, 'moral.RUSTACEAN': 5, treasury: -5000 },
      },
      { label: LATER, effects: { 'moral.RUSTACEAN': -10, requeue: { delaySprints: 1 } } },
    ],
  }),
  card({
    id: 'dark-mode-outage',
    title: t('Le mode sombre a cassé la page de paiement', 'Dark mode broke the payment page'),
    description: t(
      'Le bouton « Payer » est noir sur noir. Le chiffre d’affaires du jour : 0 €.',
      'The "Pay" button is black on black. Today\'s revenue: €0.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    choices: [
      {
        label: t('Hotfix immédiat', 'Immediate hotfix'),
        effects: { stability: -2, moral: -3, treasury: -5000 },
      },
      {
        label: t(
          'Dire que c’est un « dark pattern » voulu',
          'Claim it is an intentional "dark pattern"',
        ),
        effects: { users: -6, hype: 2 },
      },
    ],
  }),
  card({
    id: 'ddos-attack',
    title: t('Attaque DDoS', 'DDoS attack'),
    description: t(
      'Des millions de requêtes arrivent. Soit c’est une attaque, soit vous êtes enfin connus.',
      "Millions of requests are coming in. Either it's an attack, or you are finally famous.",
    ),
    conditions: { minPhase: 'SEED', gauges: { users: { min: 1000 } } },
    weight: 5,
    choices: [
      {
        label: t('Payer une protection anti-DDoS', 'Pay for DDoS protection'),
        effects: { treasury: -25000, stability: 5 },
      },
      { label: t('Attendre que ça passe', 'Wait it out'), effects: { stability: -10, users: -3 } },
    ],
  }),
];
