import type { DevRole } from '@oss/shared';

/**
 * Mini-bios drôles. `{name}` et `{age}` sont remplacés à la génération.
 * Chaque entrée est une paire [français, anglais].
 */
export const BIOS: Record<DevRole, readonly (readonly [string, string])[]> = {
  SENIOR_BEARD: [
    [
      '{name}, {age} ans, code en Vim depuis 1998 et ne compte pas s’arrêter.',
      '{name}, {age}, has coded in Vim since 1998 and has no plans to stop.',
    ],
    [
      '{name}, {age} ans, appelle encore le cloud « l’ordinateur de quelqu’un d’autre ».',
      '{name}, {age}, still calls the cloud "someone else\'s computer".',
    ],
    [
      '{name}, {age} ans, a écrit le code COBOL de ta banque. Et s’en souvient.',
      "{name}, {age}, wrote your bank's COBOL code. And still remembers it.",
    ],
    [
      '{name}, {age} ans, refuse tout framework plus jeune que sa barbe.',
      '{name}, {age}, refuses any framework younger than their beard.',
    ],
  ],
  TEN_X: [
    [
      '{name}, {age} ans, a mis « ninja » dans son titre LinkedIn.',
      '{name}, {age}, put "ninja" in their LinkedIn title.',
    ],
    [
      '{name}, {age} ans, livre une feature par heure. Personne ne sait comment elles marchent.',
      '{name}, {age}, ships one feature per hour. Nobody knows how they work.',
    ],
    [
      '{name}, {age} ans, nomme ses variables x, xx et xxx. Ça va plus vite.',
      "{name}, {age}, names variables x, xx and xxx. It's faster.",
    ],
    [
      '{name}, {age} ans, ne commente jamais : « le code est la documentation ».',
      '{name}, {age}, never comments: "the code is the documentation".',
    ],
  ],
  INTERN: [
    [
      '{name}, {age} ans, pense que `git push --force` veut dire « pousser avec conviction ».',
      '{name}, {age}, thinks `git push --force` means "push with conviction".',
    ],
    [
      '{name}, {age} ans, a appris React la semaine dernière sur TikTok.',
      '{name}, {age}, learned React last week on TikTok.',
    ],
    [
      '{name}, {age} ans, a déjà supprimé une base de données. « Mais c’était celle de test, non ? »',
      '{name}, {age}, already deleted a database. "But that was the test one, right?"',
    ],
    [
      '{name}, {age} ans, demande où est le bouton « déployer en prod ».',
      '{name}, {age}, asks where the "deploy to prod" button is.',
    ],
  ],
  RUSTACEAN: [
    [
      '{name}, {age} ans, a réécrit son grille-pain en Rust. Le grille-pain est memory-safe.',
      '{name}, {age}, rewrote their toaster in Rust. The toaster is memory-safe.',
    ],
    [
      '{name}, {age} ans, glisse « blazingly fast » dans chaque phrase.',
      '{name}, {age}, slips "blazingly fast" into every sentence.',
    ],
    [
      '{name}, {age} ans, a un crabe tatoué et une opinion sur ton code.',
      '{name}, {age}, has a crab tattoo and an opinion about your code.',
    ],
  ],
  DESIGNER: [
    [
      '{name}, {age} ans, voit un décalage de 1 px depuis l’autre bout de la pièce.',
      '{name}, {age}, can spot a 1px offset from across the room.',
    ],
    [
      '{name}, {age} ans, a 14 nuances de gris dans sa palette « minimaliste ».',
      '{name}, {age}, has 14 shades of grey in a "minimalist" palette.',
    ],
    [
      '{name}, {age} ans, a rendu un dev malade en disant « c’est presque bien ».',
      '{name}, {age}, made a dev sick by saying "it\'s almost right".',
    ],
  ],
  PRODUCT_OWNER: [
    [
      '{name}, {age} ans, a réservé ta salle de réunion jusqu’en 2028.',
      '{name}, {age}, booked your meeting room until 2028.',
    ],
    [
      '{name}, {age} ans, parle en user stories, même à la boulangerie.',
      '{name}, {age}, speaks in user stories, even at the bakery.',
    ],
    [
      '{name}, {age} ans, a une réunion pour préparer la réunion de préparation.',
      '{name}, {age}, has a meeting to prepare the prep meeting.',
    ],
  ],
  AI_AGENT: [
    [
      '{name}, version {age}, a 99 % de confiance dans des fonctions qui n’existent pas.',
      "{name}, version {age}, is 99% confident in functions that don't exist.",
    ],
    [
      '{name}, version {age}, s’excuse beaucoup puis recommence la même erreur.',
      '{name}, version {age}, apologises a lot, then makes the same mistake again.',
    ],
    [
      '{name}, version {age}, ne dort jamais, ne boit pas de café, ne comprend pas l’humour.',
      '{name}, version {age}, never sleeps, drinks no coffee, does not get jokes.',
    ],
  ],
  GHOST: [
    [
      '{name}, {age} ans, personne ne l’a jamais vu. Ses tickets se ferment quand même.',
      '{name}, {age}, nobody has ever seen them. Their tickets still close.',
    ],
    [
      '{name}, {age} ans, travaille « depuis Bali » avec une caméra toujours éteinte.',
      '{name}, {age}, works "from Bali" with the camera always off.',
    ],
    [
      '{name}, {age} ans, est peut-être trois stagiaires dans un trench-coat.',
      '{name}, {age}, might be three interns in a trench coat.',
    ],
  ],
  FRONTEND: [
    [
      '{name}, {age} ans, centre une div du premier coup. Personne ne sait comment.',
      '{name}, {age}, centres a div on the first try. Nobody knows how.',
    ],
    [
      '{name}, {age} ans, a changé de framework JavaScript trois fois cette semaine.',
      '{name}, {age}, switched JavaScript frameworks three times this week.',
    ],
    [
      '{name}, {age} ans, teste tout sur Safari « pour souffrir un peu ».',
      '{name}, {age}, tests everything on Safari "to suffer a little".',
    ],
  ],
  BACKEND: [
    [
      '{name}, {age} ans, pense que les interfaces graphiques sont une mode passagère.',
      '{name}, {age}, believes graphical interfaces are a passing fad.',
    ],
    [
      '{name}, {age} ans, a nommé ses plantes d’après des index de base de données.',
      '{name}, {age}, named their plants after database indexes.',
    ],
    [
      '{name}, {age} ans, répond « ça dépend » à toutes les questions. Et a raison.',
      '{name}, {age}, answers "it depends" to every question. And is right.',
    ],
  ],
  FULLSTACK: [
    [
      '{name}, {age} ans, sait tout faire un peu. Surtout copier depuis Stack Overflow.',
      '{name}, {age}, can do a bit of everything. Mostly copying from Stack Overflow.',
    ],
    [
      '{name}, {age} ans, a écrit « full-stack » sur son CV après un tutoriel de 4 h.',
      '{name}, {age}, put "full-stack" on their CV after a 4-hour tutorial.',
    ],
    [
      '{name}, {age} ans, déploie le front et le back. Parfois sur le même port.',
      '{name}, {age}, deploys the front and the back. Sometimes on the same port.',
    ],
  ],
  TECH_LEAD: [
    [
      '{name}, {age} ans, laisse 140 commentaires par pull request. Tous « nit: ».',
      '{name}, {age}, leaves 140 comments per pull request. All of them "nit:".',
    ],
    [
      '{name}, {age} ans, n’a plus codé depuis 2022 mais dessine de superbes schémas.',
      "{name}, {age}, hasn't coded since 2022 but draws gorgeous diagrams.",
    ],
    [
      '{name}, {age} ans, dit « on en reparle en rétro » à chaque problème.',
      '{name}, {age}, says "let\'s discuss it in the retro" about every problem.',
    ],
  ],
  DEVOPS: [
    [
      '{name}, {age} ans, a 47 onglets AWS ouverts et en comprend 3.',
      '{name}, {age}, has 47 AWS tabs open and understands 3 of them.',
    ],
    [
      '{name}, {age} ans, écrit du YAML plus vite que du français.',
      '{name}, {age}, writes YAML faster than English.',
    ],
    [
      '{name}, {age} ans, dort avec son téléphone d’astreinte sous l’oreiller.',
      '{name}, {age}, sleeps with the on-call phone under the pillow.',
    ],
  ],
  QA_TESTER: [
    [
      '{name}, {age} ans, trouve un bug rien qu’en regardant l’écran.',
      '{name}, {age}, finds a bug just by looking at the screen.',
    ],
    [
      '{name}, {age} ans, a commandé -1 bière dans le bar de l’appli. Elle a été livrée.',
      '{name}, {age}, ordered -1 beers in the app. They were delivered.',
    ],
    [
      '{name}, {age} ans, ne dit jamais « ça marche », seulement « pas reproduit ».',
      '{name}, {age}, never says "it works", only "could not reproduce".',
    ],
  ],
  SCRUM_MASTER: [
    [
      '{name}, {age} ans, a des post-it de 6 couleurs et une théorie pour chacune.',
      '{name}, {age}, owns sticky notes in 6 colours and has a theory for each.',
    ],
    [
      '{name}, {age} ans, commence chaque phrase par « en tant que… ».',
      '{name}, {age}, starts every sentence with "as a…".',
    ],
    [
      '{name}, {age} ans, mesure la vélocité de l’équipe et celle de la machine à café.',
      "{name}, {age}, tracks the team's velocity and the coffee machine's too.",
    ],
  ],
  MANAGER: [
    [
      '{name}, {age} ans, organise des one-to-one pour parler des one-to-one.',
      '{name}, {age}, schedules one-to-ones to talk about one-to-ones.',
    ],
    [
      '{name}, {age} ans, a lu 12 livres de management. Le 13e arrive par la poste.',
      '{name}, {age}, has read 12 management books. Number 13 is in the mail.',
    ],
    [
      '{name}, {age} ans, apaise les conflits avec des croissants. Ça marche.',
      '{name}, {age}, defuses conflicts with croissants. It works.',
    ],
  ],
  DEPUTY_DIRECTOR: [
    [
      '{name}, {age} ans, remplace le directeur en réunion et le directeur ne revient jamais.',
      '{name}, {age}, stands in for the CTO in meetings and the CTO never comes back.',
    ],
    [
      '{name}, {age} ans, signe ses mails « Bien à vous, et à votre équipe ».',
      '{name}, {age}, signs emails "Kind regards, to you and your team".',
    ],
    [
      '{name}, {age} ans, a un tableau Excel pour suivre ses tableaux Excel.',
      '{name}, {age}, keeps a spreadsheet to track their spreadsheets.',
    ],
  ],
  DIRECTOR: [
    [
      '{name}, {age} ans, a monté trois startups et en parle à chaque déjeuner.',
      '{name}, {age}, founded three startups and mentions it at every lunch.',
    ],
    [
      '{name}, {age} ans, parle de « vision » et de « synergies » sans rire.',
      '{name}, {age}, talks about "vision" and "synergies" with a straight face.',
    ],
    [
      '{name}, {age} ans, a encore un compte root sur le premier serveur de la boîte.',
      "{name}, {age}, still has root on the company's very first server.",
    ],
  ],
};
