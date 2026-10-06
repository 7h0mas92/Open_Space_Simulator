import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { authApi } from '../../api/auth';
import { useSession } from '../store/session';

type Mode = 'login' | 'register';

/** Formulaire de connexion / inscription, avec connexion GitHub si disponible. */
export function AuthPanel() {
  const { t } = useTranslation();
  const { login, register, error, setError, githubEnabled } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    setPending(true);
    if (mode === 'login') {
      await login({ email, password });
    } else {
      await register({
        email,
        password,
        pseudo: String(data.get('pseudo') ?? ''),
        locale: currentLocale(),
      });
    }
    setPending(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
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

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          {t('auth.email')}
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
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
          />
          {mode === 'register' && <small id="password-hint">{t('auth.passwordHint')}</small>}
        </label>

        {error && (
          <p className="error" role="alert">
            {t(`errors.${error}`)}
          </p>
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
