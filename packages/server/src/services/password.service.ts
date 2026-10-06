import argon2 from 'argon2';

/**
 * Hachage des mots de passe avec argon2id (recommandation OWASP).
 * Le sel est généré automatiquement et stocké dans le hash.
 */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Hash factice : permet de garder un temps de réponse constant quand l'email est inconnu. */
let dummyHash: Promise<string> | undefined;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('mot-de-passe-factice');
  await verifyPassword(await dummyHash, password);
}
