import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';

/**
 * Récompenses du mode Histoire. Chaque mission réussie en débloque une, utilisable ensuite dans
 * les autres modes (voir `UNLOCK_MODES` dans `game.ts`) : un papier peint, un sol, une couleur de
 * mobilier, un objet ou un bonus de départ. Rien n'est retiré des autres modes : ce sont des
 * nouveautés, en plus du catalogue habituel.
 *
 * Une partie retient la liste des récompenses débloquées à son lancement (`GameState.unlocks`),
 * comme sa graine : le rejeu (replays, vérification des scores) retombe sur le même état.
 */

export const STORY_REWARD_IDS = [
  'wall-blueprint',
  'perk-espresso',
  'color-gold',
  'wall-postit',
  'floor-datacenter',
  'color-neon',
  'perk-network',
  'floor-checker',
  'item-unicorn-statue',
  'item-ipo-bell',
] as const;
export const StoryRewardIdSchema = z.enum(STORY_REWARD_IDS);
export type StoryRewardId = z.infer<typeof StoryRewardIdSchema>;

/** Ce que débloque la récompense : où elle apparaît dans le jeu. */
export type StoryRewardKind = 'wall' | 'floor' | 'color' | 'item' | 'perk';

export interface StoryReward {
  readonly id: StoryRewardId;
  readonly kind: StoryRewardKind;
  readonly icon: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const STORY_REWARDS: readonly StoryReward[] = [
  {
    id: 'wall-blueprint',
    kind: 'wall',
    icon: '📐',
    name: t('Papier peint « Plans du garage »', '“Garage blueprints” wallpaper'),
    description: t(
      'Les plans de la toute première version, tracés au feutre blanc sur fond bleu. +moral, +qualité.',
      'The very first version’s plans, drawn in white marker on blue. +morale, +quality.',
    ),
  },
  {
    id: 'perk-espresso',
    kind: 'perk',
    icon: '☕',
    name: t('Bonus : expresso dès le garage', 'Perk: espresso from day one'),
    description: t(
      'Chaque nouvelle partie démarre avec une machine à expresso à la place de la cafetière.',
      'Every new game starts with an espresso machine instead of the drip coffee maker.',
    ),
  },
  {
    id: 'color-gold',
    kind: 'color',
    icon: '🥇',
    name: t('Couleur Or', 'Gold colour'),
    description: t(
      'Une teinte dorée pour repeindre le mobilier. Purement esthétique, totalement assumé.',
      'A golden finish to paint furniture with. Purely cosmetic, fully owned.',
    ),
  },
  {
    id: 'wall-postit',
    kind: 'wall',
    icon: '🗒️',
    name: t('Papier peint « Mur de post-it »', '“Sticky-note wall” wallpaper'),
    description: t(
      'Des centaines de post-it de rétrospectives jamais relues. +moral, +qualité.',
      'Hundreds of retro sticky notes nobody ever read again. +morale, +quality.',
    ),
  },
  {
    id: 'floor-datacenter',
    kind: 'floor',
    icon: '🔲',
    name: t('Sol « Dalles techniques »', '“Raised floor tiles” flooring'),
    description: t(
      'Les dalles perforées d’une salle des serveurs, avec leurs petits voyants. +moral, +qualité.',
      'Perforated server-room tiles with their little status lights. +morale, +quality.',
    ),
  },
  {
    id: 'color-neon',
    kind: 'color',
    icon: '💚',
    name: t('Couleur Néon', 'Neon colour'),
    description: t(
      'Un vert fluo de clavier gaming pour le mobilier. Visible depuis l’espace.',
      'A gaming-keyboard neon green for furniture. Visible from space.',
    ),
  },
  {
    id: 'perk-network',
    kind: 'perk',
    icon: '📇',
    name: t('Bonus : carnet d’adresses', 'Perk: address book'),
    description: t(
      'Chaque nouvelle partie démarre avec +10 de hype : tu connais du monde, maintenant.',
      'Every new game starts with +10 hype: you know people now.',
    ),
  },
  {
    id: 'floor-checker',
    kind: 'floor',
    icon: '🏁',
    name: t('Sol « Damier rétro »', '“Retro checkerboard” flooring'),
    description: t(
      'Le damier noir et blanc d’une salle d’arcade des années 80. +moral, +hype.',
      'The black-and-white checkerboard of an 80s arcade. +morale, +hype.',
    ),
  },
  {
    id: 'item-unicorn-statue',
    kind: 'item',
    icon: '🦄',
    name: t('Statue de licorne', 'Unicorn statue'),
    description: t(
      'Une licorne dorée sur son socle de marbre, pour l’accueil. +moral, +hype.',
      'A golden unicorn on a marble plinth, for the lobby. +morale, +hype.',
    ),
  },
  {
    id: 'item-ipo-bell',
    kind: 'item',
    icon: '🔔',
    name: t('Cloche de la Bourse', 'Stock exchange bell'),
    description: t(
      'La cloche qu’on sonne le jour de l’entrée en Bourse. On la sonne aussi à chaque mise en prod. +hype.',
      'The bell rung on IPO day. Also rung at every deploy. +hype.',
    ),
  },
];

const REWARDS_BY_ID = new Map(STORY_REWARDS.map((reward) => [reward.id, reward]));

export function getStoryReward(id: string): StoryReward | undefined {
  return REWARDS_BY_ID.get(id as StoryRewardId);
}

/**
 * Le contenu (objet, papier peint, sol, couleur) est-il disponible dans cette partie ? Un
 * contenu sans récompense attachée l'est toujours.
 */
export function rewardUnlocked(
  unlocks: readonly string[],
  reward: StoryRewardId | undefined,
): boolean {
  return reward === undefined || unlocks.includes(reward);
}
