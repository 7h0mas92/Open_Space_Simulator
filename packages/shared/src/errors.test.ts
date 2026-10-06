import { describe, expect, it } from 'vitest';
import { ApiErrorSchema } from './errors.js';

describe('ApiErrorSchema', () => {
  it('valide le format { error: { code, message } }', () => {
    expect(
      ApiErrorSchema.parse({ error: { code: 'NOT_FOUND', message: 'Introuvable' } }),
    ).toBeTruthy();
  });

  it('refuse un code inconnu', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'OOPS', message: '' } }).success).toBe(false);
  });
});
