import { createHash } from 'node:crypto';
import type { AdminCardBodySchema } from '@oss/shared';
import {
  BUILTIN_CARDS_VERSION,
  CardConditionsSchema,
  CardChoiceSchema,
  EVENT_CARDS,
  EventCardListSchema,
  LocalizedTextSchema,
  type AdminCard,
  type CardSetResponse,
  type EventCard,
} from '@oss/shared';
import { z } from 'zod';
import type { EventCard as EventCardRow, Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import type { PrismaClient } from '../lib/prisma.js';

/** Contenu traduit d'une carte tel que stocké dans la colonne `content`. */
const CardContentSchema = z.object({
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
});

/** Convertit une ligne de la table EventCard dans le format du jeu (validé par Zod). */
export function toEventCard(row: EventCardRow): EventCard {
  const content = CardContentSchema.parse(row.content);
  return {
    id: row.id,
    title: content.title,
    description: content.description,
    conditions: CardConditionsSchema.parse(row.conditions),
    weight: row.weight,
    cooldownSprints: row.cooldown,
    choices: z.array(CardChoiceSchema).parse(row.choices),
  };
}

export function toAdminCard(row: EventCardRow): AdminCard {
  return { ...toEventCard(row), active: row.active, updatedAt: row.updatedAt.toISOString() };
}

/** Données Prisma d'une carte (création ou mise à jour depuis le back-office ou le seed). */
export function cardData(card: z.output<typeof AdminCardBodySchema>) {
  return {
    content: { title: card.title, description: card.description },
    conditions: card.conditions as Prisma.InputJsonValue,
    choices: card.choices as Prisma.InputJsonValue,
    weight: card.weight,
    cooldown: card.cooldownSprints,
    active: card.active,
  };
}

/**
 * Empreinte d'un jeu de cartes. Deux parties jouées avec la même version ont vu exactement
 * les mêmes cartes : c'est ce qui permet de les rejouer à l'identique.
 */
export function cardsVersionOf(cards: readonly EventCard[]): string {
  return createHash('sha256').update(JSON.stringify(cards)).digest('hex').slice(0, 16);
}

/** S'assure que la version « builtin » (cartes intégrées au client) existe en base. */
export async function ensureBuiltinCardSet(prisma: PrismaClient): Promise<void> {
  await saveCardSet(prisma, BUILTIN_CARDS_VERSION, EVENT_CARDS);
}

/**
 * Versions déjà enregistrées dans `CardSet`, par connexion à la base : on n'écrit l'instantané
 * qu'une fois par version et par processus, au lieu d'un upsert à chaque partie lancée.
 */
const savedVersions = new WeakMap<PrismaClient, Set<string>>();

async function saveCardSet(prisma: PrismaClient, version: string, cards: readonly EventCard[]) {
  let saved = savedVersions.get(prisma);
  if (!saved) savedVersions.set(prisma, (saved = new Set()));
  if (saved.has(version)) return;
  await prisma.cardSet.upsert({
    where: { version },
    update: {},
    create: { version, cards: cards as Prisma.InputJsonValue },
  });
  saved.add(version);
}

/** Cartes actives servies aux joueurs, avec leur version (instantané gardé en base). */
export async function activeCardSet(prisma: PrismaClient): Promise<CardSetResponse> {
  const rows = await prisma.eventCard.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  // Base vide (seed pas encore lancé) : on sert les cartes intégrées au jeu.
  if (rows.length === 0) {
    await ensureBuiltinCardSet(prisma);
    return { version: BUILTIN_CARDS_VERSION, cards: [...EVENT_CARDS] };
  }
  const cards = rows.map(toEventCard);
  const version = cardsVersionOf(cards);
  await saveCardSet(prisma, version, cards);
  return { version, cards };
}

/** Jeu de cartes d'une version déjà servie (rejeu d'une partie, chargement d'une sauvegarde). */
export async function cardSetByVersion(
  prisma: PrismaClient,
  version: string,
): Promise<CardSetResponse> {
  if (version === BUILTIN_CARDS_VERSION) {
    await ensureBuiltinCardSet(prisma);
    return { version, cards: [...EVENT_CARDS] };
  }
  const set = await prisma.cardSet.findUnique({ where: { version } });
  if (!set) throw new AppError(404, 'UNKNOWN_CARDS_VERSION', 'Version de cartes inconnue');
  return { version, cards: EventCardListSchema.parse(set.cards) };
}
