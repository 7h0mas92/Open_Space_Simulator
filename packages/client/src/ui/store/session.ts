import type { LoginBody, Locale, RegisterBody, UserDto } from '@oss/shared';
import { create } from 'zustand';
import { authApi } from '../../api/auth';
import { ApiRequestError, type ClientErrorCode } from '../../api/client';
import i18n from '../../i18n';

type SessionStatus = 'loading' | 'guest' | 'authenticated';

interface SessionState {
  status: SessionStatus;
  user: UserDto | null;
  /** Dernière erreur d'authentification, à traduire avec t(`errors.${code}`). */
  error: ClientErrorCode | null;
  githubEnabled: boolean;
  /** Vérifie au démarrage si une session existe déjà (cookies). */
  restore: () => Promise<void>;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
  changeLanguage: (locale: Locale) => Promise<void>;
  setError: (code: ClientErrorCode | null) => void;
}

const errorCode = (error: unknown): ClientErrorCode =>
  error instanceof ApiRequestError ? error.code : 'INTERNAL_ERROR';

/** Applique la langue enregistrée dans le profil du joueur. */
function applyUser(user: UserDto) {
  if (i18n.resolvedLanguage !== user.locale) void i18n.changeLanguage(user.locale);
}

export const useSession = create<SessionState>()((set, get) => ({
  status: 'loading',
  user: null,
  error: null,
  githubEnabled: false,

  restore: async () => {
    const providers = authApi.providers().catch(() => ({ github: false }));
    try {
      const user = await authApi.me();
      applyUser(user);
      set({ status: 'authenticated', user });
    } catch {
      set({ status: 'guest', user: null });
    }
    set({ githubEnabled: (await providers).github });
  },

  login: async (body) => {
    set({ error: null });
    try {
      const user = await authApi.login(body);
      applyUser(user);
      set({ status: 'authenticated', user });
    } catch (error) {
      set({ error: errorCode(error) });
    }
  },

  register: async (body) => {
    set({ error: null });
    try {
      const user = await authApi.register(body);
      set({ status: 'authenticated', user });
    } catch (error) {
      set({ error: errorCode(error) });
    }
  },

  logout: async () => {
    await authApi.logout().catch(() => undefined);
    set({ status: 'guest', user: null, error: null });
  },

  changeLanguage: async (locale) => {
    await i18n.changeLanguage(locale);
    // Connecté : la langue est aussi enregistrée côté serveur pour les prochaines sessions.
    if (get().status === 'authenticated') {
      const user = await authApi.updateMe({ locale }).catch(() => null);
      if (user) set({ user });
    }
  },

  setError: (code) => set({ error: code }),
}));
