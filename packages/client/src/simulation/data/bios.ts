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
};
