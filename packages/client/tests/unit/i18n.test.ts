import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import fr from '../../src/i18n/fr.json';
import { ERROR_CODES } from '@oss/shared';

/** Liste toutes les clés d'un objet de traduction : "auth.login", "errors.NOT_FOUND"... */
function keysOf(object: object, prefix = ''): string[] {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keysOf(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('Traductions', () => {
  it('le français et l’anglais ont exactement les mêmes clés', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort());
  });

  it('aucune traduction n’est vide', () => {
    for (const translations of [fr, en]) {
      const empty = keysOf(translations).filter((key) => {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], translations);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty).toEqual([]);
    }
  });

  it('chaque code d’erreur de l’API a un message traduit', () => {
    for (const code of [...ERROR_CODES, 'NETWORK_ERROR']) {
      expect(fr.errors).toHaveProperty(code);
      expect(en.errors).toHaveProperty(code);
    }
  });
});
