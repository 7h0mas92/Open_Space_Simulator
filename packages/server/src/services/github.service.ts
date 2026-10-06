import { z } from 'zod';
import type { Env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

/** Profil GitHub minimal dont le jeu a besoin. */
export interface GithubProfile {
  githubId: string;
  login: string;
  /** Email principal vérifié, s'il existe. */
  email: string | null;
}

const TokenResponseSchema = z.object({ access_token: z.string() });
const UserResponseSchema = z.object({ id: z.number(), login: z.string() });
const EmailsResponseSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }),
);

const oauthFailed = (message: string) => new AppError(502, 'OAUTH_FAILED', message);

/**
 * Client OAuth GitHub. `fetch` est injectable pour pouvoir simuler GitHub dans les tests.
 * Doc : https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */
export class GithubService {
  constructor(
    private readonly env: Env,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.env.GITHUB_CLIENT_ID && this.env.GITHUB_CLIENT_SECRET);
  }

  private credentials(): { clientId: string; clientSecret: string } {
    const { GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret } = this.env;
    if (!clientId || !clientSecret) {
      throw new AppError(503, 'OAUTH_NOT_CONFIGURED', 'Connexion GitHub non configurée');
    }
    return { clientId, clientSecret };
  }

  authorizeUrl(state: string): string {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', this.credentials().clientId);
    url.searchParams.set('redirect_uri', this.env.GITHUB_CALLBACK_URL);
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    url.searchParams.set('allow_signup', 'true');
    return url.toString();
  }

  /** Échange le code d'autorisation contre un profil GitHub. */
  async fetchProfile(code: string): Promise<GithubProfile> {
    const { clientId, clientSecret } = this.credentials();
    const tokenResponse = await this.fetchFn('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: this.env.GITHUB_CALLBACK_URL,
      }),
    });
    const token = TokenResponseSchema.safeParse(await tokenResponse.json());
    if (!tokenResponse.ok || !token.success) throw oauthFailed('Code GitHub invalide');

    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.data.access_token}`,
      'User-Agent': 'open-space-simulator',
    };
    const [userResponse, emailsResponse] = await Promise.all([
      this.fetchFn('https://api.github.com/user', { headers }),
      this.fetchFn('https://api.github.com/user/emails', { headers }),
    ]);
    const user = UserResponseSchema.safeParse(await userResponse.json());
    if (!userResponse.ok || !user.success) throw oauthFailed('Profil GitHub illisible');

    // L'email est facultatif : un utilisateur peut masquer ses emails.
    const emails = emailsResponse.ok
      ? EmailsResponseSchema.safeParse(await emailsResponse.json())
      : undefined;
    const primary = emails?.success
      ? emails.data.find((entry) => entry.primary && entry.verified)
      : undefined;

    return {
      githubId: String(user.data.id),
      login: user.data.login,
      email: primary ? primary.email.toLowerCase() : null,
    };
  }
}
