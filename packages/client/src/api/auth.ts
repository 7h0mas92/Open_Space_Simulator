import {
  AuthResponseSchema,
  OkResponseSchema,
  type LoginBody,
  type RegisterBody,
  type UpdateMeBody,
  type UserDto,
} from '@oss/shared';
import { z } from 'zod';
import { apiRequest } from './client';

const ProvidersSchema = z.object({ password: z.literal(true), github: z.boolean() });
export type AuthProviders = z.infer<typeof ProvidersSchema>;

/** Appels d'authentification. Les jetons voyagent en cookies httpOnly, jamais en JS. */
export const authApi = {
  register: async (body: RegisterBody): Promise<UserDto> =>
    (
      await apiRequest('/auth/register', {
        method: 'POST',
        body,
        schema: AuthResponseSchema,
        retryOnUnauthorized: false,
      })
    ).user,

  login: async (body: LoginBody): Promise<UserDto> =>
    (
      await apiRequest('/auth/login', {
        method: 'POST',
        body,
        schema: AuthResponseSchema,
        retryOnUnauthorized: false,
      })
    ).user,

  logout: async (): Promise<void> => {
    await apiRequest('/auth/logout', { method: 'POST', schema: OkResponseSchema });
  },

  me: async (): Promise<UserDto> => (await apiRequest('/me', { schema: AuthResponseSchema })).user,

  updateMe: async (body: UpdateMeBody): Promise<UserDto> =>
    (await apiRequest('/me', { method: 'PATCH', body, schema: AuthResponseSchema })).user,

  providers: (): Promise<AuthProviders> =>
    apiRequest('/auth/providers', { schema: ProvidersSchema }),

  /** La connexion GitHub est une redirection pleine page, pas un appel fetch. */
  githubLoginUrl: '/api/auth/github',
};
