import { EventCardListSchema, STORY_CARDS, type EventCard } from '@oss/shared';

/**
 * Bibliothèque de cartes chargée au démarrage (depuis l'API, le cache hors ligne ou
 * les cartes intégrées au jeu). Elle ne fait pas partie de l'état sauvegardé : l'état
 * ne retient que des identifiants de cartes.
 */
export class CardLibrary {
  readonly cards: readonly EventCard[];
  private readonly byId: Map<string, EventCard>;

  constructor(cards: readonly EventCard[]) {
    this.cards = cards;
    // Les cartes de l'histoire en actes ne sont pas en base : on les retrouve toujours par leur
    // identifiant (jamais tirées, la longue partie les impose, voir `storyCardSystem`).
    this.byId = new Map([...STORY_CARDS, ...cards].map((card) => [card.id, card]));
  }

  /** Valide des cartes venues de l'extérieur (API, cache) avant de les utiliser. */
  static parse(data: unknown): CardLibrary {
    return new CardLibrary(EventCardListSchema.parse(data));
  }

  get(id: string): EventCard | undefined {
    return this.byId.get(id);
  }

  get size(): number {
    return this.cards.length;
  }
}
