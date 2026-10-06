import { ErrorCodeSchema } from '@oss/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPanel } from './components/AuthPanel';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useSession } from './store/session';

/** Lit et efface les paramètres laissés dans l'URL par le retour OAuth GitHub. */
function consumeOAuthRedirect(setError: ReturnType<typeof useSession.getState>['setError']) {
  const params = new URLSearchParams(window.location.search);
  const authError = ErrorCodeSchema.safeParse(params.get('authError'));
  if (authError.success) setError(authError.data);
  if (params.has('authError') || params.has('login')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

/**
 * Écran d'accueil du socle. Le canvas Three.js et le HUD viendront s'insérer
 * dans `<main>` aux étapes « Scène 3D » et « Interface ».
 */
export function App() {
  const { t } = useTranslation();
  const { status, user, restore, logout, setError } = useSession();

  useEffect(() => {
    consumeOAuthRedirect(setError);
    void restore();
  }, [restore, setError]);

  return (
    <div className="app">
      <header className="topbar">
        <LanguageSwitcher />
      </header>
      <main className="menu">
        <h1>{t('app.title')}</h1>
        <p className="pitch">{t('app.pitch')}</p>

        {status === 'loading' && <p aria-live="polite">{t('auth.loading')}</p>}

        {status === 'authenticated' && user && (
          <section className="panel" aria-live="polite">
            <p className="welcome">{t('menu.welcome', { pseudo: user.pseudo })}</p>
            {user.role === 'ADMIN' && <p className="badge">{t('menu.admin')}</p>}
            <p>{t('menu.comingSoon')}</p>
            <button type="button" className="primary" disabled>
              {t('menu.newGame')}
            </button>
            <button type="button" onClick={() => void logout()}>
              {t('menu.logout')}
            </button>
          </section>
        )}

        {status === 'guest' && <AuthPanel />}
      </main>
    </div>
  );
}
