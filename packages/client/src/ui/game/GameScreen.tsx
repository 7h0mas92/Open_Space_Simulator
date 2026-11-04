import { useEffect } from 'react';
import { modeRules, type Speed } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { BuildMode } from '../build/BuildMode';
import { CareerPanel } from '../career/CareerPanel';
import { SelectionBar } from '../build/SelectionBar';
import { Dashboard } from '../dashboard/Dashboard';
import { Kanban } from '../kanban/Kanban';
import { Credits } from '../settings/Credits';
import { Leaderboard } from '../meta/Leaderboard';
import { SaveSlots } from '../menu/SaveSlots';
import { SlackPanel } from '../slack/SlackPanel';
import { SlackDock } from '../slack/SlackDock';
import { SettingsPanel } from '../settings/SettingsPanel';
import { useGame, type PanelId, type Toast } from '../store/game';
import { useSettings } from '../store/settings';
import { Funding } from '../funding/Funding';
import { Group } from '../group/Group';
import { DailyMoment } from '../meetings/DailyMoment';
import { StoryScene, useStoryScene, useStoryScenes } from '../story/StoryScene';
import { MeetingRoom } from '../meetings/MeetingRoom';
import { TicketApp } from '../meetings/TicketApp';
import { Pets } from '../pets/Pets';
import { Lobby } from '../lobby/Lobby';
import { ServerRoom } from '../servers/ServerRoom';
import { Cleaning } from '../cleaning/Cleaning';
import { Business } from '../business/Business';
import { SubscriptionsPanel } from '../subscriptions/Subscriptions';
import { Hiring } from '../team/Hiring';
import { Team } from '../team/Team';
import { Guide } from '../tutorial/Guide';
import { CampaignPanel } from '../story/CampaignPanel';
import { ResearchPanel } from '../story/ResearchPanel';
import { MarketPanel } from '../story/MarketPanel';
import { MissionPanel } from '../story/MissionPanel';
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
import { gridStep } from '../../view/placement';

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
    case 'tickets':
      return <TicketApp view={view} />;
    case 'pets':
      return <Pets view={view} />;
    case 'servers':
      return <ServerRoom view={view} />;
    case 'lobby':
      return <Lobby view={view} />;
    case 'cleaning':
      return <Cleaning view={view} />;
    case 'business':
      return <Business view={view} />;
    case 'subscriptions':
      return <SubscriptionsPanel view={view} />;
    case 'funding':
      return <Funding view={view} />;
    case 'career':
      return <CareerPanel view={view} />;
    case 'market':
      return view.campaign ? (
        <MarketPanel market={view.campaign.market} users={view.gauges.users} />
      ) : null;
    case 'research':
      return view.research ? <ResearchPanel research={view.research} /> : null;
    case 'mission':
      return view.campaign ? (
        <CampaignPanel campaign={view.campaign} sprint={view.time.sprint} />
      ) : (
        <MissionPanel view={view} />
      );
    case 'dashboard':
      return <Dashboard view={view} />;
    case 'slack':
      return <SlackPanel />;
    case 'saves':
      return <SaveSlots mode="save" />;
    case 'leaderboard':
      return <Leaderboard inGame />;
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
 * Raccourcis clavier globaux : Échap, espace (pause), 1, 2 et 4 (vitesse), B (construction),
 * K (Kanban), T (équipe) et, objet en main, R (tourner), flèches (déplacer l'aperçu d'une
 * demi-case), Entrée (poser). La liste est reprise dans les options (`ShortcutList`).
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
        // Une demi-case par appui pour les objets qui s'y posent, une case sinon.
        const { cell } = game.build;
        const step = gridStep(game.build.kind);
        game.setBuildCell({ x: cell.x + arrow[0] * step, z: cell.z + arrow[1] * step });
      } else if (game.build?.kind && event.key === 'Enter' && target?.tagName !== 'BUTTON') {
        event.preventDefault();
        void game.placeAt();
      } else if (key === 'b' && !game.panel && game.view && !game.replayOf) {
        if (game.build) game.exitBuild();
        else game.enterBuild();
      } else if (
        ['1', '2', '4'].includes(event.key) &&
        !game.build &&
        !game.panel &&
        game.view?.step === 'EXECUTION' &&
        // Une carte ou une demande d'augmentation garde ses propres touches 1 et 2.
        stageScreen(game.view) === null
      ) {
        void game.dispatch({ type: 'setSpeed', speed: Number(event.key) as Speed });
      } else if ((key === 'k' || key === 't') && !game.build && game.view) {
        const panel = key === 'k' ? 'kanban' : 'team';
        game.openPanel(game.panel === panel ? null : panel);
      } else if (
        event.key === ' ' &&
        game.view?.step === 'EXECUTION' &&
        modeRules(game.view.mode).canPause &&
        // Une carte ouverte tient déjà le temps en pause jusqu'à la réponse.
        !game.view.event &&
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

/** Mode Histoire : le briefing de la mission s'ouvre au lancement (pas à la reprise). */
function useMissionBriefing() {
  // La longue partie ouvre ses objectifs après la scène de l'acte (`useStoryScenes`).
  const opening = useGame(
    (s) => s.view?.mode === 'STORY' && !s.view.campaign && s.view.tick === 0 && !s.replayOf,
  );
  const seed = useGame((s) => s.view?.seed);
  useEffect(() => {
    if (opening) useGame.getState().openPanel('mission');
    // Une seule fois par mission lancée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  // Longue partie : scènes de l'histoire, puis objectifs de l'acte.
  useStoryScenes();
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
  const inScene = useStoryScene((s) => s.scene !== null);
  useShortcuts();
  useGameFeeds();
  useMissionBriefing();

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
      {!building && <DailyMoment view={view} />}
      <StoryScene />
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
            <SystemButtons view={view} />
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
      {/* Le guide attend la fin d'une scène de l'histoire. */}
      {!replayOf && !inScene && <Guide view={view} />}
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
