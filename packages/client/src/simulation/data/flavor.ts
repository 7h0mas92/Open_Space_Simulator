/**
 * Textes d'ambiance générés par la simulation : retours d'utilisateurs à la démo,
 * faux posts LinkedIn de démission, acheteurs. Paires [français, anglais].
 */

export type TextPair = readonly [string, string];

/** Retours quand le sprint s'est bien passé. */
export const FEEDBACK_GOOD: readonly TextPair[] = [
  [
    '« Enfin une app qui ne plante pas quand je respire. »',
    '"Finally an app that doesn\'t crash when I breathe."',
  ],
  ['« Mon chat l’utilise aussi. 5 étoiles. »', '"My cat uses it too. 5 stars."'],
  [
    '« J’ai annulé mon mariage pour tester la nouvelle feature. »',
    '"I cancelled my wedding to try the new feature."',
  ],
  [
    '« C’est comme Notion, mais en mieux. Ou en moins bien. Mais j’aime. »',
    '"It\'s like Notion, but better. Or worse. But I love it."',
  ],
  ['« Le mode sombre m’a sauvé la vie. Littéralement. »', '"Dark mode saved my life. Literally."'],
  [
    '« J’ai montré l’app à ma mère, elle a compris. Bravo. »',
    '"I showed the app to my mum, she understood it. Well done."',
  ],
  [
    '« Je recommande à tous mes collègues. Surtout ceux que je n’aime pas. »',
    '"I recommend it to all my colleagues. Especially the ones I don\'t like."',
  ],
  [
    '« Plus rapide que mon ancienne startup préférée. RIP. »',
    '"Faster than my previous favourite startup. RIP."',
  ],
];

/** Retours quand la prod est instable ou que rien n'a été livré. */
export const FEEDBACK_BAD: readonly TextPair[] = [
  [
    '« L’app a planté pendant que j’écrivais cet avis. »',
    '"The app crashed while I was writing this review."',
  ],
  ['« 1 étoile. J’aurais mis 0 si c’était possible. »', '"1 star. I would give 0 if I could."'],
  [
    '« Où est passé le bouton ? Il était là hier. »',
    '"Where did the button go? It was there yesterday."',
  ],
  [
    '« Votre dernière mise à jour a supprimé mes données. Merci. »',
    '"Your last update deleted my data. Thanks."',
  ],
  [
    '« Le chargement est plus long que mon trajet en RER. »',
    '"Loading takes longer than my commute."',
  ],
  ['« J’ai reçu 47 notifications à 3h du matin. »', '"I got 47 notifications at 3am."'],
  [
    '« Rien de nouveau depuis deux semaines. Vous êtes en vacances ? »',
    '"Nothing new in two weeks. Are you on holiday?"',
  ],
  [
    '« Ça marchait mieux avant. Tout marchait mieux avant. »',
    '"It worked better before. Everything worked better before."',
  ],
];

/** Retours neutres ou absurdes. */
export const FEEDBACK_NEUTRAL: readonly TextPair[] = [
  [
    '« Je ne sais pas à quoi sert l’app, mais le logo est joli. »',
    '"I don\'t know what the app does, but the logo is nice."',
  ],
  ['« Vous comptez ajouter de la blockchain ? »', '"Are you planning to add blockchain?"'],
  ['« Est-ce que ça marche sur ma télé ? »', '"Does it work on my TV?"'],
  [
    '« J’ai cliqué partout. Rien n’a explosé. 3 étoiles. »',
    '"I clicked everywhere. Nothing exploded. 3 stars."',
  ],
  [
    '« Pourquoi faut-il un compte pour lire la FAQ ? »',
    '"Why do I need an account to read the FAQ?"',
  ],
];

/** Faux posts LinkedIn de démission. `{name}` est remplacé par le nom du dev. */
export const LINKEDIN_POSTS: readonly TextPair[] = [
  [
    '{name} : « Après une aventure incroyable, je suis ravi·e d’annoncer que je pars vers de nouveaux défis. Merci pour les 4 réunions par jour. #NewBeginnings »',
    '{name}: "After an incredible journey, I\'m thrilled to announce I\'m moving on to new challenges. Thanks for the 4 meetings a day. #NewBeginnings"',
  ],
  [
    '{name} : « Ce que mon burn-out m’a appris sur le leadership (thread 🧵 1/27) »',
    '{name}: "What my burnout taught me about leadership (thread 🧵 1/27)"',
  ],
  [
    '{name} : « Je quitte la startup pour élever des chèvres dans le Larzac. Agile, mais avec des chèvres. »',
    '{name}: "Leaving the startup to raise goats in the countryside. Still agile, but with goats."',
  ],
  [
    '{name} : « Humbled and honored de rejoindre une boîte où la prod ne tombe pas le vendredi. »',
    '{name}: "Humbled and honored to join a company where prod doesn\'t go down on Fridays."',
  ],
  [
    '{name} : « J’ai démissionné. Voici 5 leçons de vie que j’ai apprises en debuggant à 2h du matin. »',
    '{name}: "I quit. Here are 5 life lessons I learned debugging at 2am."',
  ],
  [
    '{name} : « Open to work. Ne m’appelez pas pour du legacy. »',
    '{name}: "Open to work. Don\'t call me about legacy code."',
  ],
];

/** Big techs qui peuvent proposer un rachat. */
export const BUYERS: readonly TextPair[] = [
  ['Gougle', 'Gougle'],
  ['Mégasoft', 'Megasoft'],
  ['Amazone', 'Amazone'],
  ['Pomme Inc.', 'Pear Inc.'],
  ['Méta-Verse Corp', 'Meta-Verse Corp'],
  ['Oracle de Delphes', 'Oracle of Delphi'],
];
