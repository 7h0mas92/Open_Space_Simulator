import type { GameMode } from '@oss/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { saves } from '../../save/saves';
import { APP_BUILD, formatBuild } from '../../version';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { formatGauge } from '../game/format';
import { useGame } from '../store/game';
import { useSession } from '../store/session';
import { useSettings } from '../store/settings';
import { AccountBar } from './AccountBar';
import { MODE_ICONS, ModePicker } from './ModePicker';
import { useLatestSave } from './useLatestSave';

/** Pages du menu ouvertes depuis l'accueil. */
export type MenuPage =
  | 'story'
  | 'load'
  | 'leaderboard'
  | 'achievements'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'credits'
  | 'career';

/**
 * Écran d'accueil : titre et bouton Jouer (ou Continuer et Nouvelle partie quand une partie
 * est en cours), choix du mode en cartes, navigation vers les pages du méta-jeu, compte et
 * langue en haut.
 */
export function HomeMenu({
  onOpen,
  toast,
}: {
  onOpen: (page: MenuPage) => void;
  toast: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const status = useSession((s) => s.status);
  const isAdmin = useSession((s) => s.user?.role === 'ADMIN');
  const startGame = useGame((s) => s.start);
  const loading = useGame((s) => s.loading);
  const notify = useGame((s) => s.notify);
  const tutorialDone = useSettings((s) => s.tutorialDone);
  const online = status === 'authenticated';
  const latest = useLatestSave(online, status !== 'loading');
  // Une réplique de Slack différente à chaque visite du menu.
  const [tickerIndex] = useState(() => Math.random());
  const ticker = t('menu.ticker', { returnObjects: true }) as unknown as string[];
  const tickerLine = ticker[Math.floor(tickerIndex * ticker.length)] ?? '';

  // Le mode Carrière commence par le choix d'une légende.
  const play = (mode: GameMode) =>
    mode === 'CAREER' ? onOpen('career') : void startGame({ mode });
  // Premier lancement : le mode Facile et son tutoriel complet. Ensuite, le mode Normal.
  const suggested: GameMode = tutorialDone ? 'NORMAL' : 'EASY';

  async function resume() {
    if (!latest) return;
    try {
      await startGame({ save: await saves.load(latest.slot, online) });
    } catch {
      notify('saves.failed', 'error');
    }
  }

  const links: { page: MenuPage; icon: string; label: string; hidden?: boolean }[] = [
    { page: 'load', icon: '💾', label: t('menu.continue') },
    { page: 'leaderboard', icon: '🏆', label: t('leaderboard.title') },
    { page: 'achievements', icon: '🏅', label: t('achievements.title') },
    { page: 'profile', icon: '👤', label: t('profile.title') },
    { page: 'settings', icon: '⚙️', label: t('panels.settings') },
    { page: 'admin', icon: '🛠', label: t('admin.heading'), hidden: !isAdmin },
    { page: 'credits', icon: '©', label: t('panels.credits') },
  ];

  return (
    <div className="home">
      <header className="home-topbar">
        <LanguageSwitcher />
        <AccountBar />
      </header>

      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <p className="home-kicker" aria-hidden="true">
            <span className="home-dot" /> {tickerLine}
          </p>
          <h1 id="home-title">{t('app.title')}</h1>
          <p className="pitch">{t('app.pitch')}</p>

          {status === 'loading' ? (
            <p aria-live="polite">{t('auth.loading')}</p>
          ) : (
            <div className="home-cta">
              {latest ? (
                <button
                  type="button"
                  className="primary cta"
                  disabled={loading}
                  onClick={() => void resume()}
                >
                  <span aria-hidden="true">▶</span>
                  <span className="cta-text">
                    <strong>{t('menu.resume')}</strong>
                    <small>
                      {t('menu.resumeHint', {
                        mode: t(`modes.${latest.mode}.name`),
                        phase: t(`phases.${latest.phase}`),
                        sprint: latest.sprint,
                        valuation: formatGauge('treasury', latest.valuation, i18n.language),
                      })}
                    </small>
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="primary cta"
                  disabled={loading}
                  onClick={() => play(suggested)}
                >
                  <span aria-hidden="true">▶</span>
                  <span className="cta-text">
                    <strong>{t('menu.play')}</strong>
                    <small>{t('menu.playHint', { mode: t(`modes.${suggested}.name`) })}</small>
                  </span>
                </button>
              )}
              {/* Une partie en cours ne doit pas cacher le lancement d'une nouvelle. */}
              {latest && (
                <button
                  type="button"
                  className="cta cta-secondary"
                  disabled={loading}
                  onClick={() => play(suggested)}
                  data-testid="new-game"
                >
                  <span aria-hidden="true">＋</span>
                  <span className="cta-text">
                    <strong>{t('menu.newGame')}</strong>
                    <small>{t('menu.newGameHint', { mode: t(`modes.${suggested}.name`) })}</small>
                  </span>
                </button>
              )}
              {loading && <p aria-live="polite">{t('auth.loading')}</p>}
              {toast}
            </div>
          )}

          <nav className="home-nav" aria-label={t('menu.nav')}>
            {links
              .filter((link) => !link.hidden)
              .map((link) => (
                <button key={link.page} type="button" onClick={() => onOpen(link.page)}>
                  <span aria-hidden="true">{link.icon}</span> {link.label}
                </button>
              ))}
          </nav>
        </section>

        {status !== 'loading' && (
          <section className="home-modes" aria-labelledby="modes-title">
            <h2 id="modes-title">{t('modes.title')}</h2>
            <p className="hint">{t('menu.modesHint')}</p>
            <button
              type="button"
              className="mode-card mode-story"
              onClick={() => onOpen('story')}
              data-testid="mode-STORY"
            >
              <span className="mode-icon" aria-hidden="true">
                {MODE_ICONS.STORY}
              </span>
              <span className="mode-text">
                <span className="mode-name">
                  <strong>{t('modes.STORY.name')}</strong>
                  <span className="mode-tag">{t('modes.STORY.tag')}</span>
                </span>
                <small>{t('modes.STORY.rule')}</small>
              </span>
            </button>
            <ModePicker onPick={play} disabled={loading} />
          </section>
        )}
      </main>

      <footer className="home-version">
        {t('menu.version', { build: formatBuild(APP_BUILD, i18n.language) })}
      </footer>
    </div>
  );
}
