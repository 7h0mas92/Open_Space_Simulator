import { ErrorCodeSchema, type GameMode } from '@oss/shared';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPanel } from './components/AuthPanel';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ModePicker } from './menu/ModePicker';
import { SaveSlots } from './menu/SaveSlots';
import { AchievementsPage } from './meta/Achievements';
import { Leaderboard } from './meta/Leaderboard';
import { MetaPage } from './meta/MetaPage';
import { Profile } from './meta/Profile';
import { Credits } from './settings/Credits';
import { useGame } from './store/game';
import { installGameLifecycle, syncOfflineProgress } from './store/lifecycle';
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
/** Le back-office n'est téléchargé que par les administrateurs. */
const AdminPage = lazy(() =>
  import('./admin/AdminPage').then((module) => ({ default: module.AdminPage })),
);

/** Applique la taille de texte choisie dans les options à toute l'interface. */
function useTextScale() {
  const textScale = useSettings((s) => s.textScale);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(textScale));
  }, [textScale]);
}

/** Écrans du menu (hors partie). */
type Screen = 'home' | 'load' | 'leaderboard' | 'achievements' | 'profile' | 'admin' | 'credits';

/** Menu d'accueil (connexion ou invité, choix du mode), pages du méta-jeu, puis la partie. */
export function App() {
  const { t } = useTranslation();
  const { status, user, restore, logout, setError } = useSession();
  const inGame = useGame((s) => s.view !== null);
  const startGame = useGame((s) => s.start);
  const loading = useGame((s) => s.loading);
  const toast = useGame((s) => s.toast);
  // Après une partie, on revient à l'écran d'où elle a été lancée (classement pour un replay).
  const [screen, setScreen] = useState<Screen>('home');
  useTextScale();

  useEffect(() => {
    consumeOAuthRedirect(setError);
    void restore();
    return installGameLifecycle();
  }, [restore, setError]);

  // Connecté : on envoie ce qui a été joué hors ligne (sauvegardes, succès).
  useEffect(() => {
    if (status === 'authenticated') void syncOfflineProgress();
  }, [status]);

  if (inGame) {
    return (
      <Suspense fallback={<p className="loading">{t('auth.loading')}</p>}>
        <GameScreen />
      </Suspense>
    );
  }

  const back = () => setScreen('home');
  const play = (mode: GameMode) => void startGame({ mode });
  const menuToast =
    toast?.key && toast.tone === 'error' ? (
      <p className="toast toast-error" role="alert">
        {String(t(toast.key as never))}
      </p>
    ) : null;

  switch (screen) {
    case 'load':
      return (
        <MetaPage title={t('saves.title')} onBack={back}>
          <SaveSlots mode="load" />
          {menuToast}
        </MetaPage>
      );
    case 'leaderboard':
      return (
        <MetaPage title={t('leaderboard.title')} onBack={back} wide>
          <Leaderboard />
          {menuToast}
        </MetaPage>
      );
    case 'profile':
      return (
        <MetaPage title={t('profile.title')} onBack={back} wide>
          <Profile onOpenAchievements={() => setScreen('achievements')} />
        </MetaPage>
      );
    case 'achievements':
      return (
        <MetaPage title={t('achievements.title')} onBack={back} wide>
          <AchievementsPage />
        </MetaPage>
      );
    case 'admin':
      return (
        <MetaPage title={t('admin.heading')} onBack={back} wide>
          {user?.role === 'ADMIN' ? (
            <Suspense fallback={<p>{t('auth.loading')}</p>}>
              <AdminPage />
            </Suspense>
          ) : (
            <p className="error">{t('errors.FORBIDDEN')}</p>
          )}
        </MetaPage>
      );
    case 'credits':
      return (
        <MetaPage title={t('panels.credits')} onBack={back}>
          <Credits />
        </MetaPage>
      );
    case 'home':
      break;
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

        {status !== 'loading' && (
          <section className="panel" aria-labelledby="play-title">
            {status === 'authenticated' && user ? (
              <p className="welcome">
                {t('menu.welcome', { pseudo: user.pseudo })}
                {user.role === 'ADMIN' && <span className="badge">{t('menu.admin')}</span>}
              </p>
            ) : (
              <small>{t('menu.guestHint')}</small>
            )}
            <h2 id="play-title">{t('modes.title')}</h2>
            <ModePicker onPick={play} disabled={loading} />
            {loading && <p aria-live="polite">{t('auth.loading')}</p>}
            {menuToast}
            <nav className="menu-links" aria-label={t('menu.more')}>
              <button type="button" onClick={() => setScreen('load')}>
                💾 {t('menu.continue')}
              </button>
              <button type="button" onClick={() => setScreen('leaderboard')}>
                🏆 {t('leaderboard.title')}
              </button>
              <button type="button" onClick={() => setScreen('achievements')}>
                🏅 {t('achievements.title')}
              </button>
              <button type="button" onClick={() => setScreen('profile')}>
                👤 {t('profile.title')}
              </button>
              {user?.role === 'ADMIN' && (
                <button type="button" onClick={() => setScreen('admin')}>
                  🛠 {t('admin.heading')}
                </button>
              )}
              <button type="button" onClick={() => setScreen('credits')}>
                © {t('panels.credits')}
              </button>
              {status === 'authenticated' && (
                <button type="button" onClick={() => void logout()}>
                  {t('menu.logout')}
                </button>
              )}
            </nav>
          </section>
        )}

        {status === 'guest' && <AuthPanel />}
      </main>
    </div>
  );
}
