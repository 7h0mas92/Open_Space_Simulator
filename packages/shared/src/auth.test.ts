import { describe, expect, it } from 'vitest';
import { LoginBodySchema, PseudoSchema, RegisterBodySchema, UserDtoSchema } from './auth.js';

describe('RegisterBodySchema', () => {
  it('normalise l’email en minuscules et applique la langue par défaut', () => {
    const body = RegisterBodySchema.parse({
      email: 'Kevin@Startup.IO',
      password: 'motdepasse',
      pseudo: 'kevin_ninja',
    });
    expect(body).toEqual({
      email: 'kevin@startup.io',
      password: 'motdepasse',
      pseudo: 'kevin_ninja',
      locale: 'fr',
    });
  });

  it('refuse un mot de passe trop court', () => {
    const result = RegisterBodySchema.safeParse({
      email: 'a@b.io',
      password: '1234',
      pseudo: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('refuse une langue non supportée', () => {
    const result = RegisterBodySchema.safeParse({
      email: 'a@b.io',
      password: 'motdepasse',
      pseudo: 'abc',
      locale: 'de',
    });
    expect(result.success).toBe(false);
  });
});

describe('PseudoSchema', () => {
  it.each(['Kévin', 'dev-10x', 'senior.barbu', 'ia_agent_42'])('accepte %s', (pseudo) => {
    expect(PseudoSchema.safeParse(pseudo).success).toBe(true);
  });

  it.each(['ab', 'a'.repeat(25), 'avec espace', '<script>'])('refuse %s', (pseudo) => {
    expect(PseudoSchema.safeParse(pseudo).success).toBe(false);
  });
});

describe('LoginBodySchema', () => {
  it('refuse un email invalide', () => {
    expect(LoginBodySchema.safeParse({ email: 'pas-un-email', password: 'x' }).success).toBe(false);
  });
});

describe('UserDtoSchema', () => {
  it('valide un utilisateur GitHub sans mot de passe', () => {
    const user = UserDtoSchema.parse({
      id: 'u1',
      email: null,
      pseudo: 'octocat',
      role: 'USER',
      locale: 'en',
      hasPassword: false,
      hasGithub: true,
      createdAt: '2026-10-06T10:00:00.000Z',
    });
    expect(user.hasGithub).toBe(true);
  });
});
