import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildPanel } from '../build/BuildPanel';
import { SelectionBar } from '../build/SelectionBar';
import { Dashboard } from '../dashboard/Dashboard';
import { Kanban } from '../kanban/Kanban';
import { Credits } from '../settings/Credits';
import { SettingsPanel } from '../settings/SettingsPanel';
import { useGame, type PanelId } from '../store/game';
import { useSettings } from '../store/settings';
import { Hiring } from '../team/Hiring';
import { Team } from '../team/Team';
import { Tutorial } from '../tutorial/Tutorial';
import { ActionBar, Alerts, Gauges, TimeControls } from './Hud';
import { Scene } from './Scene';
import { Sheet } from './Sheet';
import { StageScreens } from './StageScreens';
import { localized } from './format';
import type { GameView, Rotation } from '../../view/types';

function PanelContent({ panel, view }: { panel: PanelId; view: GameView }) {
  switch (panel) {
    case 'kanban':
      return <Kanban view={view} />;
    case 'team':
      return <Team view={view} />;
    case 'hiring':
      return <Hiring view={view} />;
    case 'build':
      return <BuildPanel view={view} />;
    case 'dashboard':
      return <Dashboard view={view} />;
    case 'settings':
      return <SettingsPanel />;
    case 'credits':
      return <Credits />;
  }
}

/** Raccourcis clavier globaux : Échap, espace (pause), R (tourner en construction). */
function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const game = useGame.getState();
      if (event.key === 'Escape') {
        if (game.build) game.setBuild(null);
        else if (game.panel) game.openPanel(null);
        else game.select(null);
      } else if (event.key.toLowerCase() === 'r' && game.build?.kind) {
        game.setBuild({ ...game.build, rotation: ((game.build.rotation + 1) % 4) as Rotation });
      } else if (
        event.key === ' ' &&
        game.view?.step === 'EXECUTION' &&
        game.view.mode !== 'HARDCORE' &&
        target?.tagName !== 'BUTTON'
      ) {
        event.preventDefault();
        void game.dispatch({ type: 'setSpeed', speed: game.view.time.speed === 0 ? 1 : 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function GameScreen() {
  const { t, i18n } = useTranslation();
  const view = useGame((s) => s.view);
  const panel = useGame((s) => s.panel);
  const openPanel = useGame((s) => s.openPanel);
  const toast = useGame((s) => s.toast);
  const fps = useGame((s) => s.fps);
  const showFps = useSettings((s) => s.showFps);
  useShortcuts();

  // Les messages disparaissent seuls après quelques secondes.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => useGame.setState({ toast: null }), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!view) return null;
  return (
    <div className={`game ${panel ? 'has-panel' : ''}`} data-testid="game">
      <Scene />
      <Alerts view={view} />
      <h1 className="visually-hidden">{t('app.title')}</h1>
      <div className="hud">
        <div className="hud-top">
          <Gauges view={view} />
          <TimeControls view={view} />
        </div>
        <div className="hud-bottom">
          <SelectionBar view={view} />
          <ActionBar />
        </div>
      </div>
      {showFps && <p className="fps">{t('settings.fps', { fps })}</p>}
      {toast && (
        <p key={toast.id} className={`toast toast-${toast.tone}`} role="status">
          {toast.text
            ? localized(toast.text, i18n.language)
            : String(t((toast.key ?? '') as never, toast.params as never))}
        </p>
      )}
      <Tutorial view={view} />
      <StageScreens view={view} />
      {panel && (
        <Sheet title={t(`panels.${panel}`)} onClose={() => openPanel(null)}>
          <PanelContent panel={panel} view={view} />
        </Sheet>
      )}
    </div>
  );
}
