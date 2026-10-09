import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildMode } from '../build/BuildMode';
import { SelectionBar } from '../build/SelectionBar';
import { Dashboard } from '../dashboard/Dashboard';
import { Kanban } from '../kanban/Kanban';
import { Credits } from '../settings/Credits';
import { SaveSlots } from '../menu/SaveSlots';
import { SlackPanel } from '../slack/SlackPanel';
import { SlackDock } from '../slack/SlackDock';
import { SettingsPanel } from '../settings/SettingsPanel';
import { useGame, type PanelId, type Toast } from '../store/game';
import { useSettings } from '../store/settings';
import { Group } from '../group/Group';
import { MeetingRoom } from '../meetings/MeetingRoom';
import { Hiring } from '../team/Hiring';
import { Team } from '../team/Team';
import { Guide } from '../tutorial/Guide';
import {
  ActionBar,
  Alerts,
  PANEL_ICONS,
  Clock,
  Company,
  Gauges,
  StepControls,
  SystemButtons,
} from './Hud';
import { Scene } from './Scene';
import { Sheet } from './Sheet';
import { StageScreens, stageScreen } from './StageScreens';
import { localized } from './format';
import { useGameFeeds } from './useGameFeeds';
import type { GameView } from '../../view/types';

function PanelContent({ panel, view }: { panel: PanelId; view: GameView }) {
  switch (panel) {
    case 'kanban':
      return <Kanban view={view} />;
    case 'team':
      return <Team view={view} />;
    case 'hiring':
      return <Hiring view={view} />;
    case 'group':
      return <Group view={view} />;
    case 'meetings':
      return <MeetingRoom view={view} />;
    case 'dashboard':
      return <Dashboard view={view} />;
    case 'slack':
      return <SlackPanel />;
    case 'saves':
      return <SaveSlots mode="save" />;
    case 'settings':
      return <SettingsPanel />;
    case 'credits':
      return <Credits />;
  }
}

const TOAST_ICONS: Record<Toast['tone'], string> = { info: 'ℹ️', success: '✅', error: '⚠️' };

/** Flèches du clavier → déplacement de l'aperçu sur la grille (objet en main). */
const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Raccourcis clavier globaux : Échap, espace (pause), B (construction) et, objet en main,
 * R (tourner), flèches (déplacer l'aperçu), Entrée (poser).
 */
function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const game = useGame.getState();
      const key = event.key.toLowerCase();
      const arrow = ARROWS[event.key];
      if (event.key === 'Escape') {
        // Échap recule d'un cran : objet en main → catalogue → jeu.
        if (game.build?.kind) game.cancelPlacement();
        else if (game.build) game.exitBuild();
        else if (game.panel) game.openPanel(null);
        else game.select(null);
      } else if (game.build?.kind && key === 'r') {
        game.rotateBuild();
      } else if (game.build?.kind && arrow && game.build.cell) {
        event.preventDefault();
        const { cell } = game.build;
        game.setBuildCell({ x: cell.x + arrow[0], z: cell.z + arrow[1] });
      } else if (game.build?.kind && event.key === 'Enter' && target?.tagName !== 'BUTTON') {
        event.preventDefault();
        void game.placeAt();
      } else if (key === 'b' && !game.panel && game.view && !game.replayOf) {
        if (game.build) game.exitBuild();
        else game.enterBuild();
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
  const replayOf = useGame((s) => s.replayOf);
  const building = useGame((s) => s.build !== null);
  useShortcuts();
  useGameFeeds();

  // Les messages disparaissent seuls après quelques secondes.
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => useGame.setState({ toast: null }), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!view) return null;
  return (
    <div
      className={`game ${panel ? 'has-panel' : ''} ${building ? 'is-building' : ''} ${
        stageScreen(view) ? 'has-stage' : ''
      }`}
      data-testid="game"
    >
      <Scene />
      <Alerts view={view} />
      <h1 className="visually-hidden">{t('app.title')}</h1>
      {building ? (
        // Construction : le HUD habituel s'efface pour laisser la scène au joueur.
        <BuildMode view={view} />
      ) : (
        <div className="hud">
          {/* En haut ce qu'on lit, en bas ce qu'on fait. */}
          <header className="hud-top">
            <Company view={view} />
            <Gauges view={view} />
            <Clock view={view} />
            <SystemButtons />
          </header>
          <div className="hud-bottom">
            <SelectionBar view={view} />
            <div className="command-dock">
              <ActionBar />
              <StepControls view={view} />
            </div>
          </div>
        </div>
      )}
      {showFps && <p className="fps">{t('settings.fps', { fps })}</p>}
      {toast && (
        <p key={toast.id} className={`toast toast-${toast.tone}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {TOAST_ICONS[toast.tone]}
          </span>
          {toast.text
            ? localized(toast.text, i18n.language)
            : String(t((toast.key ?? '') as never, toast.params as never))}
        </p>
      )}
      {replayOf && view.replay && (
        <p className="replay-banner" role="status">
          ▶{' '}
          {t('replay.banner', {
            pseudo: replayOf,
            played: view.replay.played,
            total: view.replay.total,
          })}
        </p>
      )}
      {panel !== 'slack' && !building && <SlackDock />}
      {/* Le tutoriel s'adapte au mode de jeu (voir tutorial/lessons.ts). */}
      {!replayOf && <Guide view={view} />}
      <StageScreens view={view} />
      {panel && (
        <Sheet
          title={t(`panels.${panel}`)}
          icon={PANEL_ICONS[panel]}
          onClose={() => openPanel(null)}
        >
          <PanelContent panel={panel} view={view} />
        </Sheet>
      )}
    </div>
  );
}
