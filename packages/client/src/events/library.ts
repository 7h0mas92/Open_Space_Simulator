import { EventCardListSchema, type EventCard } from '@oss/shared';

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
    this.byId = new Map(cards.map((card) => [card.id, card]));
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
