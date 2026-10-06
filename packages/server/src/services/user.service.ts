import type { UserDto } from '@oss/shared';
import type { User } from '../generated/prisma/client.js';
import type { PrismaClient } from '../lib/prisma.js';

/** Convertit un utilisateur de la base en DTO public (sans hash de mot de passe). */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    pseudo: user.pseudo,
    role: user.role,
    locale: user.locale,
    hasPassword: user.passwordHash !== null,
    hasGithub: user.githubId !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Renvoie un pseudo libre dérivé de `base` (ex. « octocat », puis « octocat-2 »...).
 * Utilisé pour les comptes créés via GitHub, dont le login peut déjà être pris.
 */
export async function findAvailablePseudo(prisma: PrismaClient, base: string): Promise<string> {
  const cleaned =
    base
      .replace(/[^\p{L}\p{N}_.-]/gu, '')
      .slice(0, 20)
      .padEnd(3, '_') || 'dev';
  for (let suffix = 1; suffix < 1000; suffix++) {
    const candidate = suffix === 1 ? cleaned : `${cleaned}-${suffix}`;
    const taken = await prisma.user.findUnique({ where: { pseudo: candidate } });
    if (!taken) return candidate;
  }
  return `${cleaned.slice(0, 12)}-${Date.now().toString(36)}`;
}
