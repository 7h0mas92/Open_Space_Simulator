import { EmailSchema, PasswordSchema, PseudoSchema } from '@oss/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { authApi } from '../../api/auth';
import { useSession } from '../store/session';

type Mode = 'login' | 'register';
type Field = 'email' | 'pseudo' | 'password' | 'passwordMissing';

/**
 * Vérifie les champs avant l'envoi, avec les mêmes schémas Zod que le serveur, pour dire
 * précisément au joueur quoi corriger (traduit avec t(`auth.invalid.${champ}`)).
 */
function invalidField(mode: Mode, email: string, pseudo: string, password: string): Field | null {
  if (!EmailSchema.safeParse(email).success) return 'email';
  if (mode === 'register' && !PseudoSchema.safeParse(pseudo).success) return 'pseudo';
  if (password === '') return 'passwordMissing';
  if (mode === 'register' && !PasswordSchema.safeParse(password).success) return 'password';
  return null;
}

/** Formulaire de connexion / inscription, avec connexion GitHub si disponible. */
export function AuthPanel() {
  const { t } = useTranslation();
  const { login, register, restore, error, setError, githubEnabled, serverAvailable } =
    useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<Field | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    const pseudo = String(data.get('pseudo') ?? '');
    const invalid = invalidField(mode, email, pseudo, password);
    setFieldError(invalid);
    if (invalid) {
      setError(null);
      return;
    }
    setPending(true);
    if (mode === 'login') {
      await login({ email, password });
    } else {
      await register({ email, password, pseudo, locale: currentLocale() });
    }
    setPending(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setFieldError(null);
  }

  async function retry() {
    setPending(true);
    setError(null);
    await restore();
    setPending(false);
  }

  // Pas de serveur derrière le jeu (version en ligne en mode invité, ou API locale éteinte) :
  // on le dit clairement plutôt que de laisser le joueur remplir un formulaire voué à l'échec.
  if (!serverAvailable) {
    return (
      <section className="panel auth-panel auth-offline" aria-labelledby="auth-title">
        <h3 id="auth-title">{t('auth.offlineTitle')}</h3>
        <p role="status">{t('auth.offlineText')}</p>
        <button type="button" disabled={pending} onClick={() => void retry()}>
          {pending ? t('auth.loading') : t('auth.retry')}
        </button>
      </section>
    );
  }

  return (
    <section className="panel auth-panel" aria-labelledby="auth-title">
      <h2 id="auth-title" className="visually-hidden">
        {t(mode === 'login' ? 'auth.login' : 'auth.register')}
      </h2>
      <div className="tabs" role="tablist">
        {(['login', 'register'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => switchMode(tab)}
          >
            {t(tab === 'login' ? 'auth.login' : 'auth.register')}
          </button>
        ))}
      </div>

      {/* noValidate : nos propres messages, dans le ton du jeu, plutôt que les bulles du navigateur. */}
      <form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <label>
          {t('auth.email')}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={fieldError === 'email'}
          />
        </label>
        {mode === 'register' && (
          <label>
            {t('auth.pseudo')}
            <input
              name="pseudo"
              autoComplete="nickname"
              required
              minLength={3}
              maxLength={24}
              aria-describedby="pseudo-hint"
              aria-invalid={fieldError === 'pseudo'}
            />
            <small id="pseudo-hint">{t('auth.pseudoHint')}</small>
          </label>
        )}
        <label>
          {t('auth.password')}
          <input
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            maxLength={128}
            aria-describedby={mode === 'register' ? 'password-hint' : undefined}
            aria-invalid={fieldError === 'password' || fieldError === 'passwordMissing'}
          />
          {mode === 'register' && <small id="password-hint">{t('auth.passwordHint')}</small>}
        </label>

        {fieldError ? (
          <p className="error" role="alert">
            {t(`auth.invalid.${fieldError}`)}
          </p>
        ) : (
          error && (
            <p className="error" role="alert">
              {t(`errors.${error}`)}
            </p>
          )
        )}

        <button type="submit" className="primary" disabled={pending}>
          {pending
            ? t('auth.loading')
            : t(mode === 'login' ? 'auth.submitLogin' : 'auth.submitRegister')}
        </button>
      </form>

      {githubEnabled && (
        <>
          <p className="separator">{t('auth.or')}</p>
          <a className="button github" href={authApi.githubLoginUrl}>
            {t('auth.github')}
          </a>
        </>
      )}
    </section>
  );
}
