import type { LocalizedText } from '../i18n.js';
import type { StoryActId } from './acts.js';

/**
 * Scènes dialoguées de l'histoire « Ctrl+Alt+Fonder » : une au début de chaque acte, une pour
 * chaque fin écrite (entrée en Bourse, rachat par Gigacorp) et une pour l'entrée en Saison
 * libre. Texte seulement : elles s'affichent dans l'interface et ne touchent jamais l'état de la
 * partie (pas de tirage, rien à rejouer).
 *
 * Personnages récurrents, tous inventés, sans nom ni logo réels.
 */

export const STORY_CHARACTERS = {
  narrator: { name: { fr: 'Narration', en: 'Narrator' }, icon: '📖' },
  you: { name: { fr: 'Toi', en: 'You' }, icon: '🧑‍💻' },
  hugo: { name: { fr: 'Hugo, ton ami dev', en: 'Hugo, your dev friend' }, icon: '🧔' },
  bastien: { name: { fr: 'Bastien Lemaître', en: 'Bastien Lemaître' }, icon: '🦊' },
  josette: { name: { fr: 'Mamie Josette', en: 'Granny Josette' }, icon: '👵' },
  ines: { name: { fr: 'Inès Kader, TechMatin', en: 'Inès Kader, TechMorning' }, icon: '📰' },
  gigacorp: { name: { fr: 'Gigacorp', en: 'Gigacorp' }, icon: '🏢' },
} as const satisfies Record<string, { name: LocalizedText; icon: string }>;

export type StoryCharacter = keyof typeof STORY_CHARACTERS;

export interface SceneLine {
  readonly speaker: StoryCharacter;
  readonly text: LocalizedText;
}

export const STORY_SCENE_IDS = [
  'prologue',
  'race',
  'price-war',
  'giant',
  'bell',
  'ending-ipo',
  'ending-acquisition',
  'free-season',
] as const;
export type StorySceneId = (typeof STORY_SCENE_IDS)[number];

const line = (speaker: StoryCharacter, fr: string, en: string): SceneLine => ({
  speaker,
  text: { fr, en },
});

export const STORY_SCENES: Readonly<Record<StorySceneId, readonly SceneLine[]>> = {
  prologue: [
    line(
      'narrator',
      'Lundi, 9h. Dans la tour d’en face, Synergix coupe le ruban de ses nouveaux bureaux.',
      'Monday, 9 a.m. In the tower across the street, Synergix cuts the ribbon on its new offices.',
    ),
    line(
      'bastien',
      'Merci aux investisseurs d’avoir cru en MON idée. Une idée qui m’est venue… tout seul.',
      'Thanks to our investors for believing in MY idea. An idea I came up with… all by myself.',
    ),
    line(
      'hugo',
      'Il a même gardé tes slides. Il a juste changé la police. Bon, on code ?',
      'He even kept your slides. He just changed the font. So, shall we code?',
    ),
    line(
      'josette',
      'Mon petit, j’ai vendu le camping-car. Tu as 2 millions, ne les dépense pas en bonbons.',
      'Sweetie, I sold the camper van. You have 2 million, don’t spend it all on candy.',
    ),
    line(
      'you',
      'Un garage, un ami et un premier commit. Objectif : la Seed, avant le sprint 12.',
      'A garage, a friend and a first commit. Goal: the Seed round, before sprint 12.',
    ),
  ],
  race: [
    line(
      'ines',
      'TechMatin : « Synergix, la pépite de l’année ? » Un lecteur m’écrit qu’il existe un garage qui fait mieux.',
      'TechMorning: “Synergix, startup of the year?” A reader tells me a garage is doing better.',
    ),
    line(
      'bastien',
      'Joli bureau. Dis à ton meilleur dev que chez nous, il y a des sieste-pods.',
      'Nice office. Tell your best dev we have nap pods over here.',
    ),
    line(
      'hugo',
      'Il vient d’écrire à toute l’équipe sur LinkedIn. Même au stagiaire.',
      'He just messaged the whole team on LinkedIn. Even the intern.',
    ),
    line(
      'you',
      'Alors on le dépasse. Plus d’utilisateurs que Synergix, et la Série A avant le sprint 26.',
      'Then we overtake him. More users than Synergix, and the Series A before sprint 26.',
    ),
  ],
  'price-war': [
    line(
      'narrator',
      'Une nouvelle enseigne violette s’allume sur un toit : Pivotly. Leur produit change toutes les deux semaines.',
      'A new purple sign lights up on a rooftop: Pivotly. Their product changes every two weeks.',
    ),
    line(
      'ines',
      'Pivotly divise ses prix par deux. Leur PDG : « Le prix, c’est un état d’esprit. »',
      'Pivotly halves its prices. Their CEO: “Price is a state of mind.”',
    ),
    line(
      'josette',
      'J’ai vu ta startup dans le journal ! À côté des mots croisés. C’est bien placé ?',
      'I saw your startup in the paper! Next to the crossword. Is that a good spot?',
    ),
    line(
      'you',
      'On ne joue pas aux prix. On tient la prod, on tient l’équipe, et on devient licorne avant le sprint 44.',
      'We don’t play the price game. We keep prod up, keep the team together and become a unicorn before sprint 44.',
    ),
  ],
  giant: [
    line(
      'gigacorp',
      'Communiqué : Gigacorp acquiert Synergix. Nous lançons aussi Gigacorp Teams+, gratuit pour tous.',
      'Press release: Gigacorp acquires Synergix. We are also launching Gigacorp Teams+, free for everyone.',
    ),
    line(
      'bastien',
      'Je suis maintenant « VP Synergies » chez Gigacorp. On a un toboggan ET un deuxième toboggan.',
      'I am now “VP of Synergies” at Gigacorp. We have a slide AND a second slide.',
    ),
    line(
      'hugo',
      'Leur clone a ton bug du formulaire d’inscription. Ils ont copié jusqu’au bug.',
      'Their clone has your sign-up form bug. They copied the bug too.',
    ),
    line(
      'you',
      'Il faut valoir 1,5 milliard et garder 30 % du marché avant le sprint 52. Le géant n’est pas invincible.',
      'We need to be worth 1.5 billion and keep 30% of the market before sprint 52. The giant isn’t invincible.',
    ),
  ],
  bell: [
    line(
      'gigacorp',
      'Nous aimerions vous racheter. Chèque en blanc. Bastien vous fera visiter les toboggans.',
      'We would like to buy you. Blank check. Bastien will give you the slide tour.',
    ),
    line(
      'josette',
      'Mon petit, fais ce qui te rend heureux. Mais la Bourse, ça ferait joli sur le frigo.',
      'Sweetie, do what makes you happy. But the stock exchange would look nice on the fridge.',
    ),
    line(
      'ines',
      'Toute la place parle de vous. Bourse ou rachat ? Je réserve ma une.',
      'Everyone is talking about you. IPO or buyout? I’m holding my front page.',
    ),
    line(
      'you',
      'Accepter l’offre de rachat, ou lancer l’entrée en Bourse. C’est à moi d’écrire la fin.',
      'Accept the buyout offer, or launch the IPO. The ending is mine to write.',
    ),
  ],
  'ending-ipo': [
    line(
      'narrator',
      'Wall Street, 9h30. Tu sonnes la cloche. Hugo filme en portrait, évidemment.',
      'Wall Street, 9:30 a.m. You ring the bell. Hugo films it in portrait mode, of course.',
    ),
    line(
      'ines',
      'Une : « Du garage à la Bourse : l’idée volée qui valait des milliards. » Je l’avais dit.',
      'Front page: “From garage to stock exchange: the stolen idea worth billions.” Called it.',
    ),
    line(
      'bastien',
      '…Bravo. Gigacorp recrute un VP Synergies, si jamais tu cherches.',
      '…Congrats. Gigacorp is hiring a VP of Synergies, if you’re ever looking.',
    ),
    line(
      'josette',
      'J’ai acheté une action. Une seule, c’est cher. Je l’ai mise sur le frigo.',
      'I bought one share. Just one, they’re pricey. I put it on the fridge.',
    ),
    line(
      'you',
      'L’histoire est finie. La startup, elle, continue : tu peux rester n°1 en Saison libre.',
      'The story is over. The startup carries on: you can stay number one in the Free season.',
    ),
  ],
  'ending-acquisition': [
    line(
      'narrator',
      'Siège de Gigacorp. Un stylo en or, un contrat de 400 pages et un toboggan en arrière-plan.',
      'Gigacorp headquarters. A gold pen, a 400-page contract and a slide in the background.',
    ),
    line(
      'gigacorp',
      'Bienvenue dans la famille. Votre produit garde son nom pendant au moins six semaines.',
      'Welcome to the family. Your product keeps its name for at least six weeks.',
    ),
    line(
      'bastien',
      'On est collègues, maintenant. Ton bureau est à côté du mien. J’ai déjà copié ta plante.',
      'We’re colleagues now. Your desk is next to mine. I already copied your plant.',
    ),
    line(
      'josette',
      'Tu as remboursé le camping-car, et même un deuxième. Je suis fière de toi.',
      'You paid back the camper van, and a second one too. I’m proud of you.',
    ),
    line(
      'hugo',
      'Je pars monter une startup dans un garage. J’ai une idée. Ne la répète à personne.',
      'I’m off to start a company in a garage. I have an idea. Don’t tell anyone.',
    ),
  ],
  'free-season': [
    line(
      'narrator',
      'Saison libre : plus de date limite. Tous les 10 sprints, une nouvelle startup s’attaque à ton marché.',
      'Free season: no more deadlines. Every 10 sprints, a new startup goes after your market.',
    ),
    line(
      'ines',
      'Les marchés attendent de la croissance chaque trimestre. Bon courage.',
      'The markets expect growth every quarter. Good luck.',
    ),
  ],
};

/** Scène du début d'un acte (même identifiant que l'acte). */
export function actScene(act: StoryActId): StorySceneId {
  return act;
}
