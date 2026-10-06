import { z } from 'zod';
import { LocaleSchema } from './i18n.js';

export const ROLES = ['USER', 'ADMIN'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const EmailSchema = z
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

/** 8 caractères minimum ; 128 maximum pour éviter un hachage argon2 abusivement long. */
export const PasswordSchema = z.string().min(8).max(128);

/** Pseudo public affiché dans les classements. */
export const PseudoSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N}_.-]+$/u, 'Lettres, chiffres, "_", "." et "-" uniquement');

export const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  pseudo: PseudoSchema,
  locale: LocaleSchema.default('fr'),
});
export type RegisterBody = z.input<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});
export type LoginBody = z.input<typeof LoginBodySchema>;

export const UpdateMeBodySchema = z
  .object({
    pseudo: PseudoSchema,
    locale: LocaleSchema,
  })
  .partial();
export type UpdateMeBody = z.input<typeof UpdateMeBodySchema>;

/** Utilisateur tel qu'exposé par l'API (jamais de hash de mot de passe). */
export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  pseudo: z.string(),
  role: RoleSchema,
  locale: LocaleSchema,
  hasPassword: z.boolean(),
  hasGithub: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const AuthResponseSchema = z.object({ user: UserDtoSchema });
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;
