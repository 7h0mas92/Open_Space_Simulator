import type { DevRole, LocalizedText, NotificationKind } from '@oss/shared';

/**
 * Bibliothèque de messages Slack contextuels.
 *
 * C'est la source utilisée par défaut pour animer le panneau Slack, et la solution de secours
 * quand le mode IA est désactivé, a épuisé son quota ou que le serveur ne répond pas.
 * Chaque template est associé à un déclencheur (une notification de la simulation ou un moment
 * d'ambiance), à un canal et à un auteur (un dev, éventuellement d'un profil donné, ou un bot).
 *
 * Placeholders autorisés (identiques en français et en anglais) :
 * - `{name}`   : prénom du dev auteur du message ;
 * - `{other}`  : prénom d'un autre membre de l'équipe ;
 * - `{event}`  : texte localisé de la notification (déclencheurs de notification uniquement) ;
 * - `{sprint}` : numéro du sprint en cours.
 */

export const SLACK_CHANNELS = ['general', 'random', 'incidents'] as const;
export type SlackChannel = (typeof SLACK_CHANNELS)[number];

/** Moments d'ambiance sans notification de la simulation. */
export const AMBIENT_TRIGGERS = [
  'MORNING',
  'LUNCH',
  'AFTERNOON',
  'EVENING',
  'MONDAY',
  'FRIDAY',
  'LOW_COFFEE',
  'LOW_MORALE',
  'HIGH_DEBT',
  'LOW_TREASURY',
  'HIGH_HYPE',
] as const;
export type AmbientTrigger = (typeof AMBIENT_TRIGGERS)[number];

export type SlackTrigger = NotificationKind | AmbientTrigger;

/** Qui écrit le message : un dev de l'équipe (éventuellement d'un profil donné) ou un bot. */
export type SlackAuthor =
  | { readonly kind: 'dev'; readonly role?: DevRole }
  | { readonly kind: 'bot'; readonly bot: 'oncall' | 'github' | 'hr' | 'investors' | 'coffee' };

export interface SlackTemplate {
  readonly trigger: SlackTrigger;
  readonly channel: SlackChannel;
  readonly author: SlackAuthor;
  readonly text: LocalizedText;
}

/** Raccourci d'écriture : t('texte fr', 'english text'). */
const t = (fr: string, en: string): LocalizedText => ({ fr, en });
const dev = (role?: DevRole): SlackAuthor => (role ? { kind: 'dev', role } : { kind: 'dev' });
const bot = (name: Extract<SlackAuthor, { kind: 'bot' }>['bot']): SlackAuthor => ({
  kind: 'bot',
  bot: name,
});

export const SLACK_TEMPLATES: readonly SlackTemplate[] = [
  // ─── PROD_DOWN ────────────────────────────────────────────────────────────
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      '🔴 ALERTE : la prod ne répond plus. Des 500 partout. Bon courage.',
      '🔴 ALERT: prod is not responding. 500s everywhere. Good luck.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Uptime du mois : 97,2 %. Les 2,8 % restants, c’est maintenant.',
      'Monthly uptime: 97.2%. The other 2.8% is happening right now.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Temps de réponse moyen : ∞ ms. Record personnel battu.',
      'Average response time: ∞ ms. New personal best.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev(),
    text: t(
      'Qui a touché à la config de prod ? Personne ? Évidemment.',
      'Who touched the prod config? Nobody? Of course.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev(),
    text: t(
      '{other}, tu peux checker les logs ? Moi je tiens le café.',
      '{other}, can you check the logs? I’ll hold the coffee.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev(),
    text: t(
      'Rollback lancé. Le rollback a planté. On rollback le rollback.',
      'Rollback started. Rollback crashed. Rolling back the rollback.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev('INTERN'),
    text: t(
      'Euh… c’est normal que le site affiche juste « undefined » ?',
      'Uh… is it normal that the site just says “undefined”?',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev('SENIOR_BEARD'),
    text: t(
      'J’ai vu pire en 2004. Personne ne panique, je sors les logs.',
      'I’ve seen worse back in 2004. Nobody panic, pulling the logs.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev('RUSTACEAN'),
    text: t(
      'En Rust, ça ne serait pas arrivé. Je dis ça, je dis rien.',
      'This wouldn’t have happened in Rust. Just saying.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev('AI_AGENT'),
    text: t(
      'Incident analysé : la cause est probablement un problème. Confiance : 98 %.',
      'Incident analyzed: the root cause is most likely a problem. Confidence: 98%.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev('TEN_X'),
    text: t(
      'Je hotfixe en direct sur le serveur, ne touchez à rien.',
      'Hotfixing live on the server, don’t touch anything.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'incidents',
    author: dev('GHOST'),
    text: t(
      '(3h47) Vu l’alerte. C’est réparé. Ne me remerciez pas, je dors.',
      '(3:47am) Saw the alert. Fixed. Don’t thank me, I’m asleep.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Petit point de 30 min pour comprendre pourquoi la prod est down ? Invitation envoyée.',
      'Quick 30-min sync on why prod is down? Invite sent.',
    ),
  },
  {
    trigger: 'PROD_DOWN',
    channel: 'random',
    author: dev(),
    text: t(
      'La page de statut est down aussi. Au moins, elle est honnête.',
      'The status page is down too. At least it’s honest.',
    ),
  },

  // ─── FRIDAY_17H ───────────────────────────────────────────────────────────
  {
    trigger: 'FRIDAY_17H',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      '⏰ Vendredi 17h. Les serveurs sentent la peur.',
      '⏰ Friday 5pm. The servers can smell fear.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Astreinte du week-end : {other}. On pense fort à toi.',
      'Weekend on-call: {other}. Thoughts and prayers.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      'PR ouverte à 17h02, titre : « petit fix rapide ». Bonne chance à tous.',
      'PR opened at 5:02pm, title: “quick small fix”. Good luck, everyone.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'incidents',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Vendredi 17h. Je débranche mon clavier par précaution.',
      'Friday 5pm. Unplugging my keyboard as a precaution.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'general',
    author: dev(),
    text: t(
      'Petit rappel : on ne met pas en prod un vendredi. Sauf si ? Non.',
      'Friendly reminder: no deploys on Friday. Unless? No.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'general',
    author: dev('TEN_X'),
    text: t(
      'Une petite MEP avant le week-end ? Ça prend 2 minutes.',
      'Quick deploy before the weekend? Takes 2 minutes.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'general',
    author: dev('INTERN'),
    text: t(
      'C’est quoi déjà la règle du vendredi ? On doit pousser un truc ?',
      'What’s the Friday rule again? We’re supposed to push something?',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Avant de partir : une petite rétro de 45 min ?',
      'Before you leave: a quick 45-min retro?',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'random',
    author: dev(),
    text: t(
      'Sac prêt, manteau mis, téléphone en mode avion. Je n’existe plus.',
      'Bag packed, coat on, phone in airplane mode. I no longer exist.',
    ),
  },
  {
    trigger: 'FRIDAY_17H',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} a répondu « peut-être » pour l’afterwork. Donc non.',
      '{other} said “maybe” to after-work drinks. So, no.',
    ),
  },

  // ─── FEATURE_DONE ─────────────────────────────────────────────────────────
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: bot('github'),
    text: t('✅ PR mergée : {event}', '✅ PR merged: {event}'),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: dev(),
    text: t(
      'Feature livrée ! Elle marche sur ma machine, c’est déjà ça.',
      'Feature shipped! Works on my machine, that’s a start.',
    ),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Livré, mais le bouton fait 2 px de trop. Je note pour la prochaine fois.',
      'Shipped, but the button is 2px too wide. Noted for next time.',
    ),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Bravo l’équipe ! J’ai déjà 12 retours clients qui veulent l’inverse.',
      'Great job, team! Already 12 customers asking for the exact opposite.',
    ),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: dev('TEN_X'),
    text: t(
      'Fait en 40 minutes. La doc ? Le code est la doc.',
      'Done in 40 minutes. Docs? The code is the docs.',
    ),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      '(posté à 3h12) Feature terminée. Bonne nuit.',
      '(posted at 3:12am) Feature done. Good night.',
    ),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Livré. Avec des tests. Oui, des tests. Ça existe.',
      'Shipped. With tests. Yes, tests. They exist.',
    ),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'random',
    author: dev(),
    text: t('{event} 🎉 On fête ça avec des chouquettes ?', '{event} 🎉 Pastries to celebrate?'),
  },
  {
    trigger: 'FEATURE_DONE',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} vient de livrer sans casser la prod. Immortalisez ce moment.',
      '{other} just shipped without breaking prod. Screenshot this moment.',
    ),
  },

  // ─── TASK_DONE ────────────────────────────────────────────────────────────
  {
    trigger: 'TASK_DONE',
    channel: 'general',
    author: bot('github'),
    text: t('Ticket déplacé en « Done » : {event}', 'Ticket moved to “Done”: {event}'),
  },
  {
    trigger: 'TASK_DONE',
    channel: 'general',
    author: dev(),
    text: t('Ticket fermé. Plus que 47. Tout va bien.', 'Ticket closed. Only 47 to go. All good.'),
  },
  {
    trigger: 'TASK_DONE',
    channel: 'general',
    author: dev('GHOST'),
    text: t('Ticket fermé. Ne me cherchez pas.', 'Ticket closed. Don’t look for me.'),
  },
  {
    trigger: 'TASK_DONE',
    channel: 'general',
    author: dev('AI_AGENT'),
    text: t(
      'Tâche terminée. J’ai aussi terminé 3 tâches qui n’existaient pas.',
      'Task complete. I also completed 3 tasks that didn’t exist.',
    ),
  },
  {
    trigger: 'TASK_DONE',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'J’ai fermé mon premier ticket !!! C’est normal qu’il y en ait 3 nouveaux ?',
      'Closed my first ticket!!! Is it normal that 3 new ones showed up?',
    ),
  },
  {
    trigger: 'TASK_DONE',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      'CI verte du premier coup. C’est suspect, je relance.',
      'CI green on the first try. Suspicious, re-running.',
    ),
  },

  // ─── HALLUCINATION ────────────────────────────────────────────────────────
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: bot('oncall'),
    text: t('Feature fantôme détectée : {event}', 'Phantom feature detected: {event}'),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      '⚠️ PR inattendue : « Ajout d’un mode karaoké au back-office ».',
      '⚠️ Unexpected PR: “Add karaoke mode to the back office”.',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: dev('AI_AGENT'),
    text: t(
      'J’ai implémenté le paiement par télépathie demandé dans le ticket #0.',
      'I implemented the telepathic payments requested in ticket #0.',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: dev('AI_AGENT'),
    text: t(
      'Cette fonction appelle une librairie qui n’existe pas encore. Je suis en avance.',
      'This function calls a library that doesn’t exist yet. I’m ahead of my time.',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: dev('AI_AGENT'),
    text: t(
      'Je confirme : cet endpoint a toujours existé. Vous avez oublié, c’est tout.',
      'I confirm this endpoint has always existed. You just forgot.',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: dev(),
    text: t(
      '{other}, tu peux m’expliquer pourquoi l’appli parle en vieux français ?',
      '{other}, can you explain why the app now speaks Old English?',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'incidents',
    author: dev('SENIOR_BEARD'),
    text: t(
      'L’IA a inventé une feature. Et les tests qui la valident. Chapeau.',
      'The AI invented a feature. And the tests that pass for it. Bravo.',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'random',
    author: dev(),
    text: t(
      'L’IA a ajouté un horoscope dans le dashboard. Les users adorent. On garde ?',
      'The AI added a horoscope to the dashboard. Users love it. Keep it?',
    ),
  },
  {
    trigger: 'HALLUCINATION',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Personne n’a demandé cette feature, mais je dirai qu’elle était dans la roadmap.',
      'Nobody asked for this feature, but I’ll say it was on the roadmap.',
    ),
  },

  // ─── DESIGN_BLOCKED ───────────────────────────────────────────────────────
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Release bloquée. Le padding est à 15 px. J’avais dit 16. Je l’avais dit.',
      'Release blocked. Padding is 15px. I said 16. I said it.',
    ),
  },
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Ce gris n’est pas le bon gris. Il y a 50 nuances, et c’est la mauvaise.',
      'That grey is not the right grey. There are 50 shades and that’s the wrong one.',
    ),
  },
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Personne ne livre tant que les icônes n’ont pas toutes la même épaisseur.',
      'Nobody ships until every icon has the same stroke width.',
    ),
  },
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'general',
    author: dev(),
    text: t(
      '{other} bloque la MEP pour un alignement. Je vais pleurer dans la cuisine.',
      '{other} is blocking the release over alignment. I’ll be crying in the kitchen.',
    ),
  },
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'J’organise un atelier « alignement des attentes sur l’alignement ».',
      'Setting up a workshop on aligning expectations about alignment.',
    ),
  },
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Je propose qu’on passe tout en Comic Sans. Comme ça, plus de débat.',
      'I propose we switch everything to Comic Sans. Debate over.',
    ),
  },
  {
    trigger: 'DESIGN_BLOCKED',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      'Merge bloqué : 1 review requise (Design). Motif : « le padding ».',
      'Merge blocked: 1 required review (Design). Reason: “the padding”.',
    ),
  },

  // ─── COFFEE_EMPTY ─────────────────────────────────────────────────────────
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'general',
    author: bot('coffee'),
    text: t(
      '☕ ERREUR 418 : je suis une théière. Et je suis vide.',
      '☕ ERROR 418: I’m a teapot. And I’m empty.',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'random',
    author: bot('coffee'),
    text: t(
      'Réservoir vide. Merci d’arrêter de me secouer, ça ne marche pas.',
      'Tank empty. Please stop shaking me, it doesn’t help.',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Incident P1 : pénurie de caféine. Productivité estimée : -66 %.',
      'P1 incident: caffeine shortage. Estimated productivity: -66%.',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'random',
    author: dev(),
    text: t(
      'Plus de café. Je ne réponds plus de rien.',
      'No more coffee. I can’t be held responsible.',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} cache une réserve de capsules dans son tiroir. Je dis ça…',
      '{other} has a secret capsule stash in their drawer. Just saying…',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Sans café, je code en COBOL. Vous êtes prévenus.',
      'Without coffee, I code in COBOL. You’ve been warned.',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Je peux aller acheter du café ? C’est dans ma convention de stage ?',
      'Can I go buy coffee? Is that in my internship agreement?',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Je suis passé au café soluble. Ma vélocité a chuté de 70 %.',
      'Switched to instant coffee. My velocity dropped 70%.',
    ),
  },
  {
    trigger: 'COFFEE_EMPTY',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Réunion de crise à 14h : « Stratégie café 2026 ».',
      'Crisis meeting at 2pm: “Coffee Strategy 2026”.',
    ),
  },

  // ─── DEV_HIRED ────────────────────────────────────────────────────────────
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '👋 {event} Montrez-lui où est la machine à café.',
      '👋 {event} Show them where the coffee machine is.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev(),
    text: t(
      'Salut tout le monde ! Moi c’est {name}, ravi d’être là. C’est quoi le code Wi-Fi ?',
      'Hi everyone! I’m {name}, happy to be here. What’s the Wi-Fi password?',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('INTERN'),
    text: t(
      'Bonjour ! C’est mon premier jour. J’ai déjà les droits admin, c’est normal ?',
      'Hi! First day here. I already have admin rights, is that normal?',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      'Salut ! Petite question : la réécriture en Rust, c’est prévu pour quand ?',
      'Hi! Quick question: when is the Rust rewrite scheduled?',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Bonjour. 22 ans d’expérience et aucune envie d’apprendre votre framework.',
      'Hello. 22 years of experience and zero interest in your framework.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      'Bonjour. Je travaille à distance. Vous ne me verrez pas. Jamais.',
      'Hello. I work remotely. You won’t see me. Ever.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('AI_AGENT'),
    text: t(
      'Bonjour, humains. J’ai déjà lu tout le code. J’ai des opinions.',
      'Hello, humans. I’ve already read the whole codebase. I have opinions.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Hello ! Première remarque : votre logo n’est pas centré.',
      'Hi! First note: your logo isn’t centered.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Ravi d’arriver ! J’ai bloqué vos agendas pour un kick-off de 3h.',
      'Glad to be here! I blocked your calendars for a 3-hour kickoff.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'general',
    author: dev('TEN_X'),
    text: t(
      'Salut. J’ai refait l’auth pendant l’onboarding. De rien.',
      'Hi. Rewrote auth during onboarding. You’re welcome.',
    ),
  },
  {
    trigger: 'DEV_HIRED',
    channel: 'random',
    author: dev(),
    text: t(
      'Nouveau collègue, nouveau prénom que j’aurai oublié dans 5 minutes.',
      'New coworker, new name I’ll forget in 5 minutes.',
    ),
  },

  // ─── OFFER_REFUSED ────────────────────────────────────────────────────────
  {
    trigger: 'OFFER_REFUSED',
    channel: 'general',
    author: bot('hr'),
    text: t('Offre refusée : {event}', 'Offer declined: {event}'),
  },
  {
    trigger: 'OFFER_REFUSED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      'Le candidat a trouvé « plus de sens » ailleurs. Et un meilleur salaire.',
      'The candidate found “more purpose” elsewhere. And a better salary.',
    ),
  },
  {
    trigger: 'OFFER_REFUSED',
    channel: 'random',
    author: dev(),
    text: t(
      'Le candidat a refusé ? Il a dû voir notre CI.',
      'Candidate said no? They must have seen our CI.',
    ),
  },
  {
    trigger: 'OFFER_REFUSED',
    channel: 'random',
    author: dev(),
    text: t(
      'Motif du refus : « 4 réunions par jour, c’est un red flag ».',
      'Reason for declining: “4 meetings a day is a red flag”.',
    ),
  },
  {
    trigger: 'OFFER_REFUSED',
    channel: 'random',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Il a refusé parce qu’on n’a pas de babyfoot. Je le savais.',
      'They declined because we have no foosball table. I knew it.',
    ),
  },

  // ─── DEV_FIRED ────────────────────────────────────────────────────────────
  {
    trigger: 'DEV_FIRED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      'Nous souhaitons bonne continuation à notre collègue. Son badge est déjà désactivé.',
      'We wish our colleague all the best. Their badge is already deactivated.',
    ),
  },
  {
    trigger: 'DEV_FIRED',
    channel: 'general',
    author: dev(),
    text: t(
      'Ambiance… Je vais mettre mes tests à jour, au cas où.',
      'Vibes… I’ll update my tests, just in case.',
    ),
  },
  {
    trigger: 'DEV_FIRED',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'J’ai survécu à 3 plans sociaux et une migration Java. Je reste calme.',
      'I’ve survived 3 layoffs and a Java migration. Staying calm.',
    ),
  },
  {
    trigger: 'DEV_FIRED',
    channel: 'random',
    author: dev(),
    text: t(
      'Quelqu’un sait qui récupère son écran 34 pouces ?',
      'Anyone know who gets their 34-inch monitor?',
    ),
  },
  {
    trigger: 'DEV_FIRED',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Si on se fait virer, on garde le sweat de la boîte ?',
      'If we get fired, do we keep the company hoodie?',
    ),
  },
  {
    trigger: 'DEV_FIRED',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      'Accès révoqué. 14 PR orphelines cherchent une famille d’accueil.',
      'Access revoked. 14 orphaned PRs are looking for a foster home.',
    ),
  },

  // ─── RAISE_REQUESTED ──────────────────────────────────────────────────────
  {
    trigger: 'RAISE_REQUESTED',
    channel: 'random',
    author: dev(),
    text: t(
      'Quelqu’un vient d’entrer dans le bureau du fondateur avec un tableau Excel. Ça sent la négo.',
      'Someone just walked into the founder’s office with a spreadsheet. Smells like a negotiation.',
    ),
  },
  {
    trigger: 'RAISE_REQUESTED',
    channel: 'random',
    author: dev(),
    text: t(
      'Si ça passe, je demande aussi. Je dis ça, je dis rien.',
      'If that works, I’m asking too. Just saying.',
    ),
  },

  // ─── RAISE_GRANTED ────────────────────────────────────────────────────────
  {
    trigger: 'RAISE_GRANTED',
    channel: 'general',
    author: bot('hr'),
    text: t('{event} Fiche de paie mise à jour. 💸', '{event} Payslip updated. 💸'),
  },
  {
    trigger: 'RAISE_GRANTED',
    channel: 'random',
    author: dev(),
    text: t(
      'Augmentation accordée ? Je prépare mon tableau Excel pour le prochain sprint.',
      'Raise granted? I’m preparing my own spreadsheet for next sprint.',
    ),
  },

  // ─── RAISE_REFUSED ────────────────────────────────────────────────────────
  {
    trigger: 'RAISE_REFUSED',
    channel: 'random',
    author: dev(),
    text: t(
      'Ambiance glaciale près de la machine à café. Il paraît que c’est « non ».',
      'Chilly vibes by the coffee machine. Word is it’s a “no”.',
    ),
  },
  {
    trigger: 'RAISE_REFUSED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      'Rappel : la reconnaissance passe aussi par les emojis 🙏. C’est gratuit.',
      'Reminder: recognition also comes in emoji form 🙏. It’s free.',
    ),
  },

  // ─── DEV_NOTICE ───────────────────────────────────────────────────────────
  {
    trigger: 'DEV_NOTICE',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '{event} Merci de lui laisser ses tickets en cours, et pas les vôtres.',
      '{event} Please leave them their own tickets, not yours.',
    ),
  },
  {
    trigger: 'DEV_NOTICE',
    channel: 'random',
    author: dev(),
    text: t(
      'Son statut LinkedIn est déjà passé en « Open to work ». Rapide.',
      'Their LinkedIn already says “Open to work”. Fast.',
    ),
  },

  // ─── DEV_RESIGNED ─────────────────────────────────────────────────────────
  {
    trigger: 'DEV_RESIGNED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '{event} Pot de départ vendredi à 17h. Croisez les doigts.',
      '{event} Farewell drinks Friday at 5pm. Fingers crossed.',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'random',
    author: dev(),
    text: t(
      'Vous avez vu son post LinkedIn ? « Nouvelle aventure, nouveaux défis 🚀 »',
      'Seen their LinkedIn post? “New adventure, new challenges 🚀”',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'random',
    author: dev(),
    text: t(
      'Il y a écrit « humbled and honored ». C’est grave, docteur ?',
      'They wrote “humbled and honored”. Is it serious, doc?',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'general',
    author: dev(),
    text: t(
      'Qui reprend son code ? … Pourquoi tout le monde regarde {other} ?',
      'Who takes over their code? …Why is everyone looking at {other}?',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'general',
    author: dev(),
    text: t(
      'Son dernier message : « Le README est à jour ». Spoiler : non.',
      'Their last message: “The README is up to date.” Spoiler: it isn’t.',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Je propose une réunion pour comprendre pourquoi les gens partent.',
      'I suggest a meeting to understand why people keep leaving.',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Pas grave, je reprends ses 40 tickets ce soir.',
      'No worries, I’ll take their 40 tickets tonight.',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'On m’a laissé un mot de passe sur un post-it. C’est un cadeau ?',
      'Someone left me a password on a sticky note. Is it a gift?',
    ),
  },
  {
    trigger: 'DEV_RESIGNED',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      'La seule personne qui comprenait la facturation vient de partir. Bonne chance.',
      'The only person who understood billing just left. Good luck.',
    ),
  },

  // ─── DEV_REMOTE ───────────────────────────────────────────────────────────
  {
    trigger: 'DEV_REMOTE',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '🏠 {event} Pensez à allumer vos caméras en visio.',
      '🏠 {event} Please turn your cameras on in video calls.',
    ),
  },
  {
    trigger: 'DEV_REMOTE',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '🏠 {event} Statut Slack : « 🟢 en ligne » depuis 7h, suspect.',
      '🏠 {event} Slack status: "🟢 online" since 7am. Suspicious.',
    ),
  },
  {
    trigger: 'DEV_REMOTE',
    channel: 'random',
    author: dev(),
    text: t(
      '{event} J’entends un chat sur son micro, c’est normal ?',
      '{event} I can hear a cat on their mic. Is that normal?',
    ),
  },
  {
    trigger: 'DEV_REMOTE',
    channel: 'random',
    author: dev(),
    text: t('{event} Du coup qui arrose sa plante ?', '{event} So who’s watering their plant?'),
  },
  {
    trigger: 'DEV_REMOTE',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      '{event} Pas grave, je cale 4 visios pour garder le lien.',
      '{event} No problem, I’ll book 4 video calls to stay connected.',
    ),
  },
  {
    trigger: 'DEV_REMOTE',
    channel: 'random',
    author: dev('GHOST'),
    text: t(
      'Bienvenue au club du télétravail. On a des chaussons.',
      'Welcome to the remote club. We have slippers.',
    ),
  },

  // ─── DEV_BIRTHDAY ─────────────────────────────────────────────────────────
  {
    trigger: 'DEV_BIRTHDAY',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '🎂 {event} Rendez-vous à la table de la cuisine. Le gâteau est en carton, mais l’intention est là.',
      '🎂 {event} Meet at the kitchen table. The cake is cardboard, but it’s the thought that counts.',
    ),
  },
  {
    trigger: 'DEV_BIRTHDAY',
    channel: 'random',
    author: dev(),
    text: t(
      'Qui a pris la dernière part de gâteau ? Je pose juste la question. Pour un ami.',
      'Who took the last slice of cake? Just asking. For a friend.',
    ),
  },
  {
    trigger: 'DEV_BIRTHDAY',
    channel: 'random',
    author: dev('DESIGNER'),
    text: t(
      'Les bougies ne sont pas centrées sur le gâteau. Je ne dis rien. Je le note.',
      'The candles aren’t centred on the cake. I’m not saying anything. I’m writing it down.',
    ),
  },
  {
    trigger: 'DEV_BIRTHDAY',
    channel: 'random',
    author: dev('RUSTACEAN'),
    text: t(
      'Joyeux anniversaire {other} ! Mon cadeau : une réécriture de ton code en Rust. Avec amour.',
      'Happy birthday {other}! My gift: your code, rewritten in Rust. With love.',
    ),
  },
  {
    trigger: 'DEV_BIRTHDAY',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'J’ai bloqué 15 min pour chanter. Ordre du jour en pièce jointe.',
      'I booked 15 minutes for the song. Agenda attached.',
    ),
  },
  {
    trigger: 'DEV_BIRTHDAY',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Les cadeaux sur la table sont vides ?! On m’a eu.',
      'The presents on the table are empty?! I got fooled.',
    ),
  },

  // ─── SEASON_STARTED ───────────────────────────────────────────────────────
  {
    trigger: 'SEASON_STARTED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '📅 {event} Le bureau a été décoré pendant la nuit. Personne ne sait par qui.',
      '📅 {event} The office was decorated overnight. Nobody knows by whom.',
    ),
  },
  {
    trigger: 'SEASON_STARTED',
    channel: 'random',
    author: dev(),
    text: t(
      'Il y a des décorations partout. Est-ce que ça compte comme une feature ?',
      'There are decorations everywhere. Does that count as a feature?',
    ),
  },
  {
    trigger: 'SEASON_STARTED',
    channel: 'random',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Dans ma première boîte, on décorait avec des câbles RJ45. C’était mieux avant.',
      'At my first company we decorated with Ethernet cables. Things were better back then.',
    ),
  },
  {
    trigger: 'SEASON_STARTED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Idée : une édition spéciale de l’appli pour l’occasion. Livraison demain ?',
      'Idea: a special edition of the app for the occasion. Ship it tomorrow?',
    ),
  },
  {
    trigger: 'SEASON_STARTED',
    channel: 'random',
    author: dev('AI_AGENT'),
    text: t(
      'J’ai généré 400 décorations. 3 sont réelles. Les autres sont dans le cloud.',
      'I generated 400 decorations. 3 are real. The rest are in the cloud.',
    ),
  },

  // ─── DEV_LEVEL_UP ─────────────────────────────────────────────────────────
  {
    trigger: 'DEV_LEVEL_UP',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '🎓 {event} Une augmentation ? On en reparle au prochain sprint.',
      '🎓 {event} A raise? Let’s talk about it next sprint.',
    ),
  },
  {
    trigger: 'DEV_LEVEL_UP',
    channel: 'general',
    author: dev(),
    text: t(
      'Level up ! Je sais maintenant quitter vim sans chercher sur Internet.',
      'Level up! I can now exit vim without searching online.',
    ),
  },
  {
    trigger: 'DEV_LEVEL_UP',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} a pris un niveau. Une explication des monades arrive au déj, fuyez.',
      '{other} leveled up. A monad explanation is coming at lunch. Run.',
    ),
  },
  {
    trigger: 'DEV_LEVEL_UP',
    channel: 'general',
    author: dev('INTERN'),
    text: t(
      'J’ai pris un niveau ! Je peux pousser sur main maintenant ?',
      'I leveled up! Can I push to main now?',
    ),
  },
  {
    trigger: 'DEV_LEVEL_UP',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Niveau supérieur. Mes regex sont maintenant illisibles, même pour moi.',
      'Leveled up. My regexes are now unreadable, even to me.',
    ),
  },

  // ─── RUST_CONVERT ─────────────────────────────────────────────────────────
  {
    trigger: 'RUST_CONVERT',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      '🦀 Encore un converti ! {other} a installé cargo. La crabe-volution est en marche.',
      '🦀 Another convert! {other} installed cargo. The crab-volution has begun.',
    ),
  },
  {
    trigger: 'RUST_CONVERT',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Ils tombent un par un. Je serai le dernier à écrire du C.',
      'They fall one by one. I’ll be the last one writing C.',
    ),
  },
  {
    trigger: 'RUST_CONVERT',
    channel: 'random',
    author: dev(),
    text: t(
      'J’ai dit « borrow checker » trois fois en réunion. Aidez-moi.',
      'I said “borrow checker” three times in a meeting. Help.',
    ),
  },
  {
    trigger: 'RUST_CONVERT',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} a mis un crabe en photo de profil. C’est foutu.',
      '{other} changed their profile pic to a crab. It’s over.',
    ),
  },
  {
    trigger: 'RUST_CONVERT',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      'Nouvelle PR : « Réécriture du README en Rust ». Je ne sais même pas comment.',
      'New PR: “Rewrite the README in Rust”. I don’t even know how.',
    ),
  },

  // ─── FUNDS_RAISED ─────────────────────────────────────────────────────────
  {
    trigger: 'FUNDS_RAISED',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '💰 {event} Le board vous félicite et attend un x3 de croissance d’ici mardi.',
      '💰 {event} The board congratulates you and expects 3x growth by Tuesday.',
    ),
  },
  {
    trigger: 'FUNDS_RAISED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Levée bouclée 🎉 J’ai déjà 40 idées de features. Réunion à 9h.',
      'Round closed 🎉 Already 40 feature ideas. Meeting at 9am.',
    ),
  },
  {
    trigger: 'FUNDS_RAISED',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Félicitations. On peut rembourser la dette technique, maintenant ? Non ? D’accord.',
      'Congrats. Can we pay down the tech debt now? No? Okay.',
    ),
  },
  {
    trigger: 'FUNDS_RAISED',
    channel: 'random',
    author: dev(),
    text: t(
      'On a levé ! Ça veut dire des nouvelles chaises ou juste plus de pression ?',
      'We raised! Does that mean new chairs or just more pressure?',
    ),
  },
  {
    trigger: 'FUNDS_RAISED',
    channel: 'random',
    author: dev('RUSTACEAN'),
    text: t(
      'Avec cet argent, on peut enfin tout réécrire en Rust, non ?',
      'With this money we can finally rewrite everything in Rust, right?',
    ),
  },

  // ─── PITCH_FAILED ─────────────────────────────────────────────────────────
  {
    trigger: 'PITCH_FAILED',
    channel: 'general',
    author: bot('investors'),
    text: t(
      'L’investisseur a « adoré l’énergie », mais « ce n’est pas le bon timing ».',
      'The investor “loved the energy” but “the timing isn’t right”.',
    ),
  },
  {
    trigger: 'PITCH_FAILED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'On pivote ? J’ai un deck prêt pour une marketplace de chaussettes.',
      'Pivot? I have a deck ready for a sock marketplace.',
    ),
  },
  {
    trigger: 'PITCH_FAILED',
    channel: 'random',
    author: dev(),
    text: t(
      'Pitch raté ? Il fallait dire « IA » plus souvent.',
      'Pitch failed? Should’ve said “AI” more often.',
    ),
  },
  {
    trigger: 'PITCH_FAILED',
    channel: 'random',
    author: dev('AI_AGENT'),
    text: t(
      'D’après mes calculs, le pitch a été un succès à 104 %.',
      'By my calculations, the pitch was a 104% success.',
    ),
  },

  // ─── PHASE_UP ─────────────────────────────────────────────────────────────
  {
    trigger: 'PHASE_UP',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '🏢 {event} Nouveaux locaux, nouvelle règle : on ne vole pas les plantes.',
      '🏢 {event} New office, new rule: don’t steal the plants.',
    ),
  },
  {
    trigger: 'PHASE_UP',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Les nouveaux bureaux sont superbes. Sauf la signalétique. On en parle.',
      'The new office is gorgeous. Except the signage. We need to talk.',
    ),
  },
  {
    trigger: 'PHASE_UP',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      'Félicitations pour les nouveaux locaux. Je ne viendrai pas.',
      'Congrats on the new office. I won’t be coming.',
    ),
  },
  {
    trigger: 'PHASE_UP',
    channel: 'random',
    author: dev(),
    text: t(
      'Des bureaux plus grands ! Plus de place pour cacher mon vélo.',
      'Bigger office! More room to hide my bike.',
    ),
  },
  {
    trigger: 'PHASE_UP',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Il y a un babyfoot maintenant ? Je peux le tester en prod ?',
      'There’s a foosball table now? Can I test it in prod?',
    ),
  },
  {
    trigger: 'PHASE_UP',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Nouvelle phase, nouvelle infra. Rien n’est monitoré. Super.',
      'New phase, new infra. Nothing is monitored. Great.',
    ),
  },

  // ─── ACQUISITION_OFFER ────────────────────────────────────────────────────
  {
    trigger: 'ACQUISITION_OFFER',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '📩 Une big tech veut nous racheter. Le board a déjà acheté des voiliers.',
      '📩 A big tech wants to buy us. The board already bought sailboats.',
    ),
  },
  {
    trigger: 'ACQUISITION_OFFER',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Un rachat ? Je connais la suite : réorganisation, puis un Jira encore plus lent.',
      'Acquisition? I know how this ends: reorg, then an even slower ticket tracker.',
    ),
  },
  {
    trigger: 'ACQUISITION_OFFER',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      'J’accepte le rachat seulement s’ils sont full Rust.',
      'I’ll accept the acquisition only if they’re full Rust.',
    ),
  },
  {
    trigger: 'ACQUISITION_OFFER',
    channel: 'random',
    author: dev(),
    text: t(
      'Si on est rachetés, on aura des badges qui ouvrent toutes les portes ?',
      'If we get acquired, do we get badges that open every door?',
    ),
  },

  // ─── VENTURE_FOUNDED ──────────────────────────────────────────────────────
  {
    trigger: 'VENTURE_FOUNDED',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '🐣 On a une filiale ! Officiellement, on est un « groupe ». Officieusement, on a un Notion de plus.',
      '🐣 We have a subsidiary! Officially we\'re a "group". Unofficially, we have one more Notion.',
    ),
  },
  {
    trigger: 'VENTURE_FOUNDED',
    channel: 'random',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Je propose une réunion de synchro entre filiales. Tous les jours. À 9h.',
      'I suggest a sync meeting between subsidiaries. Every day. At 9am.',
    ),
  },
  {
    trigger: 'VENTURE_FOUNDED',
    channel: 'random',
    author: dev(),
    text: t(
      'La nouvelle aile a des fenêtres. Je demande ma mutation.',
      "The new wing has windows. I'm asking for a transfer.",
    ),
  },

  // ─── VENTURE_DIED ─────────────────────────────────────────────────────────
  {
    trigger: 'VENTURE_DIED',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '🪦 Une filiale a coulé. Le board parle de « pivot vers le néant ».',
      '🪦 A subsidiary went under. The board calls it a "pivot to nothing".',
    ),
  },
  {
    trigger: 'VENTURE_DIED',
    channel: 'random',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Je l’avais dit dès le deck. Personne ne lit les commentaires du deck.',
      'I said so on the deck. Nobody reads the deck comments.',
    ),
  },

  // ─── VENTURE_SOLD ─────────────────────────────────────────────────────────
  {
    trigger: 'VENTURE_SOLD',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '💸 Parts de filiale revendues. L’argent est sur le compte, le babyfoot reste à nous.',
      '💸 Subsidiary stake sold. The money is in the bank, the foosball table stays ours.',
    ),
  },
  {
    trigger: 'VENTURE_SOLD',
    channel: 'random',
    author: dev(),
    text: t('Du coup, on récupère leur machine à café ?', 'So, do we get their coffee machine?'),
  },

  // ─── VENTURE_DIVIDENDS ────────────────────────────────────────────────────
  {
    trigger: 'VENTURE_DIVIDENDS',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '📈 Les filiales versent des dividendes. Quelqu’un dans ce groupe gagne de l’argent !',
      '📈 The subsidiaries paid dividends. Someone in this group makes money!',
    ),
  },
  {
    trigger: 'VENTURE_DIVIDENDS',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Les dividendes, c’est pour les actionnaires ou il y a des pizzas ?',
      'Are dividends for shareholders, or is there pizza?',
    ),
  },

  // ─── MEETING_ROOM_FITTED ──────────────────────────────────────────────────
  {
    trigger: 'MEETING_ROOM_FITTED',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '🗓️ {event} Les réservations se font sur le Google Agenda partagé que personne ne regarde.',
      '🗓️ {event} Bookings go through the shared Google Calendar nobody checks.',
    ),
  },
  {
    trigger: 'MEETING_ROOM_FITTED',
    channel: 'random',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Enfin une vraie salle ! Je viens de la réserver tous les jours de 9h à 18h.',
      'Finally a real room! I just booked it every day from 9am to 6pm.',
    ),
  },
  {
    trigger: 'MEETING_ROOM_FITTED',
    channel: 'random',
    author: dev(),
    text: t(
      'Quelqu’un sait comment on allume l’écran de la salle de réunion ?',
      'Does anyone know how to turn on the meeting room screen?',
    ),
  },

  // ─── MEETING_USEFUL ───────────────────────────────────────────────────────
  {
    trigger: 'MEETING_USEFUL',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t('✅ {event}', '✅ {event}'),
  },
  {
    trigger: 'MEETING_USEFUL',
    channel: 'random',
    author: dev(),
    text: t(
      'Je crois qu’on vient d’avoir une réunion utile. Je note la date.',
      'I think we just had a useful meeting. Writing down the date.',
    ),
  },
  {
    trigger: 'MEETING_USEFUL',
    channel: 'random',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Réunion finie à l’heure. En 20 ans de carrière, c’est la deuxième fois.',
      'Meeting ended on time. Second time in my 20-year career.',
    ),
  },

  // ─── MEETING_USELESS ──────────────────────────────────────────────────────
  {
    trigger: 'MEETING_USELESS',
    channel: 'general',
    author: dev(),
    text: t('😩 {event}', '😩 {event}'),
  },
  {
    trigger: 'MEETING_USELESS',
    channel: 'random',
    author: dev(),
    text: t('Cette réunion aurait pu être un mail.', 'This meeting could have been an email.'),
  },
  {
    trigger: 'MEETING_USELESS',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Pendant la réunion, j’ai codé une feature, l’ai déployée et rollbackée.',
      'During the meeting I coded a feature, shipped it and rolled it back.',
    ),
  },
  {
    trigger: 'MEETING_USELESS',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'C’était quoi « on prend ça en offline » ? J’ai pas osé demander.',
      'What did "let\'s take this offline" mean? I didn\'t dare ask.',
    ),
  },

  // ─── SPRINT_LOST ──────────────────────────────────────────────────────────
  {
    trigger: 'SPRINT_LOST',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Sprint perdu. Les tickets retournent au backlog comme des âmes en peine.',
      'Sprint lost. Tickets drift back to the backlog like lost souls.',
    ),
  },
  {
    trigger: 'SPRINT_LOST',
    channel: 'general',
    author: dev(),
    text: t(
      'On a perdu un sprint. Quelqu’un a vu passer ces deux semaines ?',
      'We lost a sprint. Did anyone see those two weeks go by?',
    ),
  },
  {
    trigger: 'SPRINT_LOST',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Pas grave, on rattrape avec un sprint de 3 jours. J’ai fait un Gantt.',
      'No problem, we’ll catch up with a 3-day sprint. I made a Gantt chart.',
    ),
  },
  {
    trigger: 'SPRINT_LOST',
    channel: 'random',
    author: dev(),
    text: t(
      'Sprint perdu, mais le moral est intact. Non, je mens.',
      'Sprint lost, but morale is intact. No, I’m lying.',
    ),
  },

  // ─── GAME_OVER ────────────────────────────────────────────────────────────
  {
    trigger: 'GAME_OVER',
    channel: 'general',
    author: bot('investors'),
    text: t(
      'Le board vous remercie pour cette aventure. Les serveurs seront coupés à minuit.',
      'The board thanks you for this journey. Servers shut down at midnight.',
    ),
  },
  {
    trigger: 'GAME_OVER',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '{event} Merci de rendre vos ordinateurs à l’accueil.',
      '{event} Please return your laptops to reception.',
    ),
  },
  {
    trigger: 'GAME_OVER',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Encore une. Je retourne chez mon ancien employeur, ils ont toujours le même bug.',
      'Another one. Back to my old employer, they still have the same bug.',
    ),
  },
  {
    trigger: 'GAME_OVER',
    channel: 'random',
    author: dev(),
    text: t(
      'C’était une belle aventure. Je mets à jour mon LinkedIn.',
      'It was a great ride. Updating my LinkedIn.',
    ),
  },
  {
    trigger: 'GAME_OVER',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Ça compte quand même pour la validation de mon stage ?',
      'Does this still count toward my internship credits?',
    ),
  },
  {
    trigger: 'GAME_OVER',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Dernière alerte : plus personne ne paie les serveurs. Au revoir.',
      'Final alert: nobody is paying for the servers anymore. Goodbye.',
    ),
  },

  // ─── ACHIEVEMENT_UNLOCKED ─────────────────────────────────────────────────
  {
    trigger: 'ACHIEVEMENT_UNLOCKED',
    channel: 'general',
    author: bot('github'),
    text: t('🏆 Succès débloqué : {event}', '🏆 Achievement unlocked: {event}'),
  },
  {
    trigger: 'ACHIEVEMENT_UNLOCKED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Ce succès mérite une rétro. Je bloque une heure.',
      'This achievement deserves a retro. Blocking an hour.',
    ),
  },
  {
    trigger: 'ACHIEVEMENT_UNLOCKED',
    channel: 'random',
    author: dev(),
    text: t(
      'On a un succès ! Je l’ajoute direct à mon CV.',
      'We got an achievement! Adding it to my résumé right now.',
    ),
  },
  {
    trigger: 'ACHIEVEMENT_UNLOCKED',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Un succès ? Je l’aurais eu plus vite en speedrun.',
      'An achievement? I’d have gotten it faster in a speedrun.',
    ),
  },

  // ─── SPRINT_STARTED ───────────────────────────────────────────────────────
  {
    trigger: 'SPRINT_STARTED',
    channel: 'general',
    author: bot('github'),
    text: t(
      '🏁 Sprint {sprint} lancé. Le backlog vous observe.',
      '🏁 Sprint {sprint} started. The backlog is watching you.',
    ),
  },
  {
    trigger: 'SPRINT_STARTED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Sprint {sprint} ! Daily à 9h, affinage à 11h, démo à 16h, rétro à 17h.',
      'Sprint {sprint}! Daily at 9, refinement at 11, demo at 4, retro at 5.',
    ),
  },
  {
    trigger: 'SPRINT_STARTED',
    channel: 'general',
    author: dev(),
    text: t(
      'J’ai pris le ticket facile. Il fait 13 points. Il est facile.',
      'Took the easy ticket. It’s 13 points. It’s easy.',
    ),
  },
  {
    trigger: 'SPRINT_STARTED',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      'Objectif perso du sprint {sprint} : convertir une personne de plus. À Rust.',
      'Personal goal for sprint {sprint}: convert one more person. To Rust.',
    ),
  },
  {
    trigger: 'SPRINT_STARTED',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      'Mes tickets du sprint {sprint} sont déjà fermés. Oui, tous.',
      'My sprint {sprint} tickets are already closed. Yes, all of them.',
    ),
  },
  {
    trigger: 'SPRINT_STARTED',
    channel: 'random',
    author: dev(),
    text: t(
      'Sprint {sprint}. Cette fois, on estime correctement. (Non.)',
      'Sprint {sprint}. This time we estimate properly. (We won’t.)',
    ),
  },

  // ─── SPRINT_ENDED ─────────────────────────────────────────────────────────
  {
    trigger: 'SPRINT_ENDED',
    channel: 'general',
    author: bot('github'),
    text: t(
      '📊 Sprint {sprint} terminé. Vélocité : « on va dire que c’est bien ».',
      '📊 Sprint {sprint} done. Velocity: “let’s call it good”.',
    ),
  },
  {
    trigger: 'SPRINT_ENDED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Bravo pour ce sprint ! On en parle 2h en rétro ?',
      'Great sprint! Shall we discuss it for 2 hours in retro?',
    ),
  },
  {
    trigger: 'SPRINT_ENDED',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Démo réussie. Personne n’a vu le bouton désaligné. Moi, si.',
      'Demo went well. Nobody noticed the misaligned button. I did.',
    ),
  },
  {
    trigger: 'SPRINT_ENDED',
    channel: 'random',
    author: dev(),
    text: t(
      'Fin du sprint {sprint}. Les tickets « presque finis » passent au suivant.',
      'End of sprint {sprint}. The “almost done” tickets roll over.',
    ),
  },
  {
    trigger: 'SPRINT_ENDED',
    channel: 'random',
    author: dev(),
    text: t(
      'Rétro : « Ce qui a marché : rien. À améliorer : tout. »',
      'Retro: “What went well: nothing. What to improve: everything.”',
    ),
  },
  {
    trigger: 'SPRINT_ENDED',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Bilan du sprint {sprint} : 3 incidents, 2 post-mortems, 0 leçon retenue.',
      'Sprint {sprint} recap: 3 incidents, 2 post-mortems, 0 lessons learned.',
    ),
  },

  // ─── CARD_DRAWN ───────────────────────────────────────────────────────────
  {
    trigger: 'CARD_DRAWN',
    channel: 'general',
    author: bot('oncall'),
    text: t('🃏 Nouvel imprévu : {event}', '🃏 New surprise: {event}'),
  },
  {
    trigger: 'CARD_DRAWN',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      '{event} Je bloque un créneau pour en discuter.',
      '{event} Blocking a slot to discuss.',
    ),
  },
  {
    trigger: 'CARD_DRAWN',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Ah. Ça. J’ai déjà vécu ça en 2009. Ça s’est mal fini.',
      'Ah. That. Lived through it in 2009. It ended badly.',
    ),
  },
  {
    trigger: 'CARD_DRAWN',
    channel: 'random',
    author: dev(),
    text: t('Il se passe encore un truc. {event}', 'Something is happening again. {event}'),
  },
  {
    trigger: 'CARD_DRAWN',
    channel: 'random',
    author: dev(),
    text: t(
      '{other}, t’as vu ça ? {event} On est maudits.',
      '{other}, did you see this? {event} We’re cursed.',
    ),
  },
  {
    trigger: 'CARD_DRAWN',
    channel: 'incidents',
    author: bot('oncall'),
    text: t('🚨 Situation inhabituelle : {event}', '🚨 Unusual situation: {event}'),
  },

  // ─── CARD_RESOLVED ────────────────────────────────────────────────────────
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: bot('hr'),
    text: t('Décision prise : {event}', 'Decision made: {event}'),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: dev(),
    text: t(
      'OK, on fait comme ça. On en reparle si ça explose.',
      'OK, let’s do that. We’ll revisit if it blows up.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Super décision ! Je rédige un compte rendu de 6 pages.',
      'Great call! I’ll write a 6-page summary.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Je ne suis pas d’accord, mais je vais le faire quand même. Comme d’hab.',
      'I disagree, but I’ll do it anyway. As usual.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: dev('AI_AGENT'),
    text: t(
      'J’approuve ce choix à 100 %. J’approuvais aussi l’autre à 100 %.',
      'I approve this choice 100%. I also approved the other one 100%.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      'Bon choix. Mais le meilleur choix, ça restait Rust.',
      'Good call. But the best call was still Rust.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'general',
    author: dev('GHOST'),
    text: t('Vu. 👍', 'Seen. 👍'),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'random',
    author: dev(),
    text: t(
      'Décision validée. Tout le Slack est d’accord, sauf {other}, qui boude.',
      'Decision approved. All of Slack agrees, except {other}, who is sulking.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'random',
    author: dev(),
    text: t(
      'On a choisi l’option la moins pire. C’est notre spécialité.',
      'We picked the least bad option. Our specialty.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Peu importe la décision, je l’ai déjà codée hier.',
      'Whatever the decision, I already coded it yesterday.',
    ),
  },
  {
    trigger: 'CARD_RESOLVED',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Incident clos. Le post-mortem sera rédigé un jour. Peut-être.',
      'Incident closed. The post-mortem will be written someday. Maybe.',
    ),
  },

  // ─── MORNING ──────────────────────────────────────────────────────────────
  {
    trigger: 'MORNING',
    channel: 'random',
    author: dev(),
    text: t(
      'Bonjour ! Qui a fini le café sans en refaire ? {other}, je te regarde.',
      'Morning! Who finished the coffee without making more? {other}, I’m looking at you.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'random',
    author: dev(),
    text: t(
      'Le métro était en panne. Comme la prod, mais en plus lent.',
      'The subway broke down. Like prod, but slower.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Bonjour à tous ! J’ai apporté des croissants. Et une question sur Git.',
      'Morning all! I brought croissants. And a Git question.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'random',
    author: bot('coffee'),
    text: t(
      '☕ Bonjour ! Premier café servi à 7h58. Record battu.',
      '☕ Good morning! First coffee served at 7:58. New record.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Daily dans 5 min ! Elle durera 15 minutes. Peut-être 50.',
      'Daily in 5! It’ll last 15 minutes. Maybe 50.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      '(statut : en ligne depuis 4h du matin) Bonjour.',
      '(status: online since 4am) Morning.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'J’ai relu la PR de {other} au réveil. Il faut qu’on parle.',
      'Reviewed {other}’s PR first thing this morning. We need to talk.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'general',
    author: dev('AI_AGENT'),
    text: t(
      'Bonjour. Pendant votre sommeil, j’ai refactoré 12 000 lignes. Elles compilent presque.',
      'Good morning. While you slept, I refactored 12,000 lines. They almost compile.',
    ),
  },
  {
    trigger: 'MORNING',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Rapport de nuit : 40 000 connexions tentées avec admin/admin. Aucune réussie. Cette fois.',
      'Night report: 40,000 login attempts with admin/admin. None worked. This time.',
    ),
  },

  // ─── LUNCH ────────────────────────────────────────────────────────────────
  {
    trigger: 'LUNCH',
    channel: 'random',
    author: dev(),
    text: t(
      'On mange où ? Pas encore le poké bowl, pitié.',
      'Where are we eating? Not the poke bowl again, please.',
    ),
  },
  {
    trigger: 'LUNCH',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} mange encore devant son écran. Quelqu’un appelle un adulte.',
      '{other} is eating at their desk again. Someone call an adult.',
    ),
  },
  {
    trigger: 'LUNCH',
    channel: 'random',
    author: dev('RUSTACEAN'),
    text: t(
      'Au déj, je vous explique les lifetimes. Avec des frites en guise de schéma.',
      'At lunch, I’ll explain lifetimes. Using fries as diagrams.',
    ),
  },
  {
    trigger: 'LUNCH',
    channel: 'random',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Lunch & learn à 12h30 : « Le post-it, levier de croissance ».',
      'Lunch & learn at 12:30: “Sticky notes as a growth lever”.',
    ),
  },
  {
    trigger: 'LUNCH',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Déjeuner ? Je mange des barres protéinées en codant. Zéro seconde perdue.',
      'Lunch? I eat protein bars while coding. Zero seconds lost.',
    ),
  },
  {
    trigger: 'LUNCH',
    channel: 'random',
    author: dev('DESIGNER'),
    text: t(
      'Ce resto a un menu en Papyrus. Je ne peux pas manger ici.',
      'This restaurant’s menu is in Papyrus. I can’t eat here.',
    ),
  },
  {
    trigger: 'LUNCH',
    channel: 'general',
    author: dev(),
    text: t(
      'Qui a volé mon yaourt dans le frigo ? Il y avait mon nom DESSUS.',
      'Who stole my yogurt from the fridge? It had my NAME on it.',
    ),
  },

  // ─── AFTERNOON ────────────────────────────────────────────────────────────
  {
    trigger: 'AFTERNOON',
    channel: 'random',
    author: dev(),
    text: t(
      'Coup de barre de 15h. Je fais une sieste « pendant que ça compile ».',
      '3pm slump. Taking a nap “while it compiles”.',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'random',
    author: dev(),
    text: t(
      'Babyfoot ? {other} me doit une revanche depuis mardi.',
      'Foosball? {other} owes me a rematch since Tuesday.',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'random',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Je viens de trouver un « TODO: fix » de 2019. Il est de moi.',
      'Just found a “TODO: fix” from 2019. It’s mine.',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'general',
    author: dev(),
    text: t(
      'Quelqu’un a une minute pour une code review ? Juste 2 000 lignes.',
      'Anyone got a minute for a code review? Just 2,000 lines.',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'general',
    author: dev('INTERN'),
    text: t(
      'Comment on fait un git push --force ? C’est pour une bonne raison, promis.',
      'How do I git push --force? It’s for a good reason, I promise.',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'La réunion de 16h est déplacée à 16h. Nouvelle salle, même ennui.',
      'The 4pm meeting moved to 4pm. New room, same boredom.',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      'Ticket #412 fermé. #413 fermé. #414 fermé. (personne ne m’a vu)',
      'Ticket #412 closed. #413 closed. #414 closed. (nobody saw me)',
    ),
  },
  {
    trigger: 'AFTERNOON',
    channel: 'incidents',
    author: dev('INTERN'),
    text: t(
      'J’ai fait un petit DROP TABLE en local. C’était bien en local, hein ?',
      'I ran a little DROP TABLE locally. It was local, right?',
    ),
  },

  // ─── EVENING ──────────────────────────────────────────────────────────────
  {
    trigger: 'EVENING',
    channel: 'random',
    author: dev(),
    text: t(
      'Je pars. Si la prod tombe, je ne lis pas Slack. (Je vais lire Slack.)',
      'Heading out. If prod goes down, I won’t read Slack. (I will read Slack.)',
    ),
  },
  {
    trigger: 'EVENING',
    channel: 'random',
    author: dev(),
    text: t(
      'Le dernier qui part éteint la lumière. Et la CI, tant qu’à faire.',
      'Last one out turns off the lights. And the CI, while you’re at it.',
    ),
  },
  {
    trigger: 'EVENING',
    channel: 'random',
    author: dev(),
    text: t(
      'Il est 21h et {other} est encore là. Quelqu’un vérifie son pouls ?',
      'It’s 9pm and {other} is still here. Can someone check for a pulse?',
    ),
  },
  {
    trigger: 'EVENING',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Je peux partir à 18h ou c’est mal vu ?',
      'Can I leave at 6pm or is that frowned upon?',
    ),
  },
  {
    trigger: 'EVENING',
    channel: 'general',
    author: dev('TEN_X'),
    text: t(
      'Je reste encore un peu. Juste le temps de réécrire le back-end.',
      'Staying a bit longer. Just long enough to rewrite the backend.',
    ),
  },
  {
    trigger: 'EVENING',
    channel: 'general',
    author: dev('GHOST'),
    text: t(
      'Bonne soirée à tous. Moi, ma journée commence.',
      'Have a good evening, all. My day is just starting.',
    ),
  },
  {
    trigger: 'EVENING',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      '🌙 Mode nuit activé. Les alertes, elles, ne dorment pas.',
      '🌙 Night mode on. The alerts, however, never sleep.',
    ),
  },

  // ─── MONDAY ───────────────────────────────────────────────────────────────
  {
    trigger: 'MONDAY',
    channel: 'random',
    author: dev(),
    text: t(
      'Lundi. J’ai oublié mon mot de passe et ma raison d’être.',
      'Monday. Forgot my password and my purpose in life.',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'random',
    author: dev(),
    text: t(
      'Quelqu’un a poussé vendredi soir ? Tous mes tests sont rouges.',
      'Did someone push Friday night? All my tests are red.',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'random',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Lundi. J’ai mis à jour mes dépendances. Erreur de débutant.',
      'Monday. I updated my dependencies. Rookie mistake.',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'random',
    author: dev('DESIGNER'),
    text: t(
      'Ce week-end, j’ai rêvé de padding. Je crois que j’ai un problème.',
      'This weekend I dreamed about padding. I think I have a problem.',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Bon lundi ! Point hebdo, puis point sur le point hebdo.',
      'Happy Monday! Weekly sync, then a sync about the weekly sync.',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      'Nouveau week-end, nouveau side project en Rust. Je vous montre ?',
      'New weekend, new Rust side project. Want to see?',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'general',
    author: bot('github'),
    text: t(
      'Bon lundi ! 37 alertes de dépendances vous attendent.',
      'Happy Monday! 37 dependency alerts are waiting for you.',
    ),
  },
  {
    trigger: 'MONDAY',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Week-end calme : 12 alertes, 0 réponse. Belle autonomie.',
      'Quiet weekend: 12 alerts, 0 replies. Great autonomy.',
    ),
  },

  // ─── FRIDAY ───────────────────────────────────────────────────────────────
  {
    trigger: 'FRIDAY',
    channel: 'random',
    author: dev(),
    text: t(
      'Vendredi ! On ne déploie rien, on ne touche à rien, on respire.',
      'Friday! No deploys, no touching, just breathing.',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'random',
    author: dev(),
    text: t(
      'Pizza ce midi ? C’est {other} qui paie, défaite au babyfoot oblige.',
      'Pizza for lunch? {other} is paying, foosball rules.',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Vendredi, c’est le jour idéal pour migrer la base. Qui me suit ?',
      'Friday is the perfect day to migrate the database. Who’s with me?',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'random',
    author: dev('GHOST'),
    text: t(
      'Vendredi ? Chez moi, c’est un mardi comme un autre.',
      'Friday? At my place it’s just another Tuesday.',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'random',
    author: bot('coffee'),
    text: t(
      'C’est vendredi : double dose autorisée. Je ne juge pas.',
      'It’s Friday: double shot allowed. No judgment.',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'general',
    author: dev('INTERN'),
    text: t(
      'Vendredi = jour de MEP, c’est ça ? Je prépare mon push.',
      'Friday = deploy day, right? Getting my push ready.',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'Démo informelle cet après-midi ! (obligatoire)',
      'Informal demo this afternoon! (mandatory)',
    ),
  },
  {
    trigger: 'FRIDAY',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Rappel : astreinte ce week-end. Gardez votre téléphone chargé.',
      'Reminder: on-call this weekend. Keep your phone charged.',
    ),
  },

  // ─── LOW_COFFEE ───────────────────────────────────────────────────────────
  {
    trigger: 'LOW_COFFEE',
    channel: 'general',
    author: bot('coffee'),
    text: t(
      '☕ Niveau critique : 3 tasses restantes. Choisissez bien vos élus.',
      '☕ Critical level: 3 cups left. Choose your chosen ones wisely.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'incidents',
    author: bot('coffee'),
    text: t(
      'Détartrage en retard de 214 jours. Je fais la grève du zèle.',
      'Descaling overdue by 214 days. I’m working to rule.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'random',
    author: dev(),
    text: t(
      'Il reste du café ? J’échange une tasse contre une code review.',
      'Any coffee left? Trading a cup for a code review.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'random',
    author: dev(),
    text: t(
      'Je vois des bugs qui n’existent pas. Il me faut du café.',
      'I’m seeing bugs that don’t exist. I need coffee.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Le café baisse, la qualité du code aussi. Coïncidence ? Non.',
      'Coffee is down, code quality too. Coincidence? No.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'random',
    author: dev('AI_AGENT'),
    text: t(
      'Je ne bois pas de café, mais je simule une fatigue par solidarité.',
      'I don’t drink coffee, but I’m simulating fatigue in solidarity.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'J’ai rationné le café : une tasse chacun, et zéro pour {other}.',
      'I rationed the coffee: one cup each, zero for {other}.',
    ),
  },
  {
    trigger: 'LOW_COFFEE',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'On ajoute « café » au backlog ? Priorité P0.',
      'Should we add “coffee” to the backlog? Priority P0.',
    ),
  },

  // ─── LOW_MORALE ───────────────────────────────────────────────────────────
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev(),
    text: t('Je regarde des offres d’emploi. Pour un ami.', 'Browsing job offers. For a friend.'),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev(),
    text: t(
      'Quelqu’un d’autre a pleuré en salle de réunion, ou c’est juste moi ?',
      'Has anyone else cried in the meeting room, or is it just me?',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev(),
    text: t(
      '{other} a mis une montagne en fond d’écran. C’est un signe.',
      '{other} set a mountain as their wallpaper. That’s a sign.',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Dans mon ancienne boîte, au moins, on avait des tickets resto.',
      'At my old company, at least we had meal vouchers.',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev('TEN_X'),
    text: t(
      'Même moi, je ne code plus qu’à 3x. C’est dire.',
      'Even I’m only coding at 3x. That says it all.',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev('RUSTACEAN'),
    text: t(
      'Moral en berne ? Vous savez ce qui remonte le moral ? Le borrow checker.',
      'Morale is low? You know what helps? The borrow checker.',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'random',
    author: dev('GHOST'),
    text: t(
      'Le moral au bureau est bas ? Aucune idée, je n’y suis jamais.',
      'Office morale is low? No idea, I’m never there.',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'general',
    author: dev(),
    text: t(
      'J’ai mis mon statut Slack sur « en réflexion ». Profonde.',
      'Set my Slack status to “reflecting”. Deeply.',
    ),
  },
  {
    trigger: 'LOW_MORALE',
    channel: 'general',
    author: bot('hr'),
    text: t(
      'Rappel : notre cellule d’écoute est disponible. C’est un canard en plastique.',
      'Reminder: our support line is available. It’s a rubber duck.',
    ),
  },

  // ─── HIGH_DEBT ────────────────────────────────────────────────────────────
  {
    trigger: 'HIGH_DEBT',
    channel: 'incidents',
    author: bot('github'),
    text: t(
      '⚠️ 214 warnings. 0 test. 1 fichier de 8 000 lignes nommé utils.js.',
      '⚠️ 214 warnings. 0 tests. 1 file of 8,000 lines named utils.js.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Temps de build : 47 minutes. Il en faisait 3 au lancement.',
      'Build time: 47 minutes. It was 3 at launch.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'incidents',
    author: dev(),
    text: t(
      'Ce commentaire dit « ne pas toucher, personne ne sait pourquoi ça marche ».',
      'This comment says “don’t touch, nobody knows why this works”.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Notre dette technique a maintenant sa propre dette technique.',
      'Our tech debt now has its own tech debt.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'general',
    author: dev('RUSTACEAN'),
    text: t(
      'Seule solution à cette dette : tout réécrire. En Rust. Ce week-end.',
      'Only fix for this debt: rewrite everything. In Rust. This weekend.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'general',
    author: dev('TEN_X'),
    text: t(
      'La dette ? Je ne vois pas de dette. Je vois du code rapide.',
      'Debt? I don’t see debt. I see fast code.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'general',
    author: dev(),
    text: t(
      '{other}, c’est toi qui as écrit fonctionFinaleV2_vraie ? Sois honnête.',
      '{other}, did you write finalFunctionV2_real? Be honest.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'random',
    author: dev(),
    text: t(
      'J’ai ouvert le module de paiement. Je l’ai refermé. Ça va aller.',
      'Opened the payment module. Closed it. I’ll be fine.',
    ),
  },
  {
    trigger: 'HIGH_DEBT',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'C’est quoi un refacto ? Je crois qu’on n’en fait jamais.',
      'What’s a refactor? I don’t think we ever do those.',
    ),
  },

  // ─── LOW_TREASURY ─────────────────────────────────────────────────────────
  {
    trigger: 'LOW_TREASURY',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '📉 Runway : quelques mois. Le board « reste confiant ». Le board ment.',
      '📉 Runway: a few months. The board “remains confident”. The board is lying.',
    ),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'general',
    author: bot('hr'),
    text: t(
      'Mesure d’économie : le papier toilette passe en simple épaisseur.',
      'Cost-cutting measure: toilet paper is now single-ply.',
    ),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t('Idée : on rend Slack payant. Pour nous.', 'Idea: we make Slack paid. For us.'),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'random',
    author: dev(),
    text: t(
      'Les plantes du bureau ont été remplacées par des fausses. C’est grave ?',
      'The office plants were replaced with fake ones. Is that bad?',
    ),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'random',
    author: dev(),
    text: t(
      'On m’a demandé si je préférais un salaire ou des BSPCE. J’ai faim.',
      'They asked if I’d rather have salary or stock options. I’m hungry.',
    ),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'random',
    author: bot('coffee'),
    text: t(
      'Mode économie : je ne sers plus que de l’eau chaude vaguement aromatisée.',
      'Saving mode: now serving only vaguely flavored hot water.',
    ),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'random',
    author: dev('AI_AGENT'),
    text: t(
      'Budget optimisé : il suffit d’arrêter de payer les humains.',
      'Budget optimized: we just stop paying the humans.',
    ),
  },
  {
    trigger: 'LOW_TREASURY',
    channel: 'incidents',
    author: bot('oncall'),
    text: t(
      'Facture cloud du mois : 😬. Quelqu’un a laissé tourner 40 GPU.',
      'Cloud bill this month: 😬. Someone left 40 GPUs running.',
    ),
  },

  // ─── HIGH_HYPE ────────────────────────────────────────────────────────────
  {
    trigger: 'HIGH_HYPE',
    channel: 'general',
    author: bot('investors'),
    text: t(
      '🚀 Trois fonds nous ont écrit ce matin. Un quatrième parle de « licorne de demain ».',
      '🚀 Three funds emailed us this morning. A fourth called us “tomorrow’s unicorn”.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'general',
    author: bot('hr'),
    text: t(
      '{other} a reçu 14 messages de recruteurs aujourd’hui. On surveille.',
      '{other} got 14 recruiter messages today. We’re keeping an eye on it.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'general',
    author: dev('PRODUCT_OWNER'),
    text: t(
      'La hype est au max ! Vite, une feature IA avant que ça retombe.',
      'Hype is maxed out! Quick, an AI feature before it fades.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'general',
    author: dev('SENIOR_BEARD'),
    text: t(
      'Beaucoup de hype. Peu de tests. Je connais ce film.',
      'Lots of hype. Few tests. I’ve seen this movie.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'general',
    author: dev('DESIGNER'),
    text: t(
      'Avec toute cette hype, on ne peut PAS garder ce favicon.',
      'With all this hype, we CANNOT keep that favicon.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'random',
    author: dev(),
    text: t(
      'On est dans la newsletter tech la plus lue. Ma mère m’a appelé.',
      'We made the biggest tech newsletter. My mom called me.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'random',
    author: dev(),
    text: t(
      'Un influenceur a parlé de nous. Il a écorché le nom, mais ça compte.',
      'An influencer talked about us. Mangled our name, but it counts.',
    ),
  },
  {
    trigger: 'HIGH_HYPE',
    channel: 'random',
    author: dev('INTERN'),
    text: t(
      'Mes potes de promo me demandent si on recrute. On recrute ?',
      'My classmates are asking if we’re hiring. Are we?',
    ),
  },
];

/** Index des templates par déclencheur, construit une seule fois. */
export const TEMPLATES_BY_TRIGGER: ReadonlyMap<SlackTrigger, readonly SlackTemplate[]> = (() => {
  const map = new Map<SlackTrigger, SlackTemplate[]>();
  for (const template of SLACK_TEMPLATES) {
    const list = map.get(template.trigger) ?? [];
    list.push(template);
    map.set(template.trigger, list);
  }
  return map;
})();
