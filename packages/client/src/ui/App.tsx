import { ErrorCodeSchema } from '@oss/shared';
import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPanel } from './components/AuthPanel';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useGame } from './store/game';
import { useSession } from './store/session';
import { useSettings } from './store/settings';

/** Lit et efface les paramètres laissés dans l'URL par le retour OAuth GitHub. */
function consumeOAuthRedirect(setError: ReturnType<typeof useSession.getState>['setError']) {
  const params = new URLSearchParams(window.location.search);
  const authError = ErrorCodeSchema.safeParse(params.get('authError'));
  if (authError.success) setError(authError.data);
  if (params.has('authError') || params.has('login')) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

/** L'écran de jeu (Three.js compris) n'est téléchargé qu'au lancement d'une partie. */
const GameScreen = lazy(() =>
  import('./game/GameScreen').then((module) => ({ default: module.GameScreen })),
);

/** Applique la taille de texte choisie dans les options à toute l'interface. */
function useTextScale() {
  const textScale = useSettings((s) => s.textScale);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(textScale));
  }, [textScale]);
}

/** Menu d'accueil (connexion ou invité), puis écran de jeu. */
export function App() {
  const { t } = useTranslation();
  const { status, user, restore, logout, setError } = useSession();
  const inGame = useGame((s) => s.view !== null);
  const startGame = useGame((s) => s.start);
  useTextScale();

  useEffect(() => {
    consumeOAuthRedirect(setError);
    void restore();
  }, [restore, setError]);

  if (inGame) {
    return (
      <Suspense fallback={<p className="loading">{t('auth.loading')}</p>}>
        <GameScreen />
      </Suspense>
    );
  }

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
            <button type="button" className="primary" onClick={() => startGame()}>
              {t('menu.newGame')}
            </button>
            <button type="button" onClick={() => void logout()}>
              {t('menu.logout')}
            </button>
          </section>
        )}

        {status === 'guest' && (
          <>
            <section className="panel guest-panel">
              <button type="button" className="primary" onClick={() => startGame()}>
                {t('menu.guest')}
              </button>
              <small>{t('menu.guestHint')}</small>
            </section>
            <AuthPanel />
          </>
        )}
      </main>
    </div>
  );
}
