/**
 * Effets de bord d'une partie, branchés sur le store du jeu : sauvegarde automatique à chaque
 * planification, publication du score à la fin (classement de l'appareil, partie retirée de
 * « Continuer »), succès gardés pour le serveur.
 */
import { ApiRequestError } from '../../api/client';
import { metaApi } from '../../api/meta';
import { pendingAchievements } from '../../save/achievements';
import { localScores } from '../../save/localScores';
import { saves } from '../../save/saves';
import { recordCareer } from '../career/records';
import type { GameView } from '../../view/types';
import { useGame } from './game';
import { useSession } from './session';
import { useStory } from './story';

const isOnline = () => useSession.getState().status === 'authenticated';

/** Date du Daily, retrouvée dans la graine (« daily-AAAA-MM-JJ »). */
export function dailyDateOf(seed: string): string | undefined {
  return /^daily-(\d{4}-\d{2}-\d{2})$/.exec(seed)?.[1];
}

/** Sauvegarde la partie en cours dans un emplacement. Renvoie vrai si le serveur l'a reçue. */
export async function saveGame(slot: number): Promise<boolean> {
  const { source, replayOf } = useGame.getState();
  if (!source || replayOf !== null) return false;
  return saves.write(slot, await source.save(), source.cardsVersion, isOnline());
}

/** Publie le score d'une partie terminée (le serveur la rejoue pour la vérifier). */
export async function submitScore(): Promise<void> {
  const { source, view, replayOf } = useGame.getState();
  if (!source || !view?.result || replayOf !== null) return;
  // Les missions du mode Histoire n'ont pas de classement (voir `recordMission`).
  if (view.mode === 'STORY') return;
  if (!isOnline()) {
    useGame.setState({ submission: { status: 'guest' } });
    return;
  }
  useGame.setState({ submission: { status: 'pending' } });
  try {
    const data = await source.save();
    const response = await metaApi.submitScore({
      mode: view.mode,
      seed: view.seed,
      commands: data.commands,
      cardsVersion: source.cardsVersion,
      dailyDate: view.mode === 'DAILY' ? dailyDateOf(view.seed) : undefined,
      // Les récompenses du mode Histoire de la partie, pour que le serveur la rejoue pareil.
      unlocks: [...view.unlocks],
      claimed: { outcome: view.result.outcome, valuation: view.result.valuation },
    });
    if (useGame.getState().source !== source) return;
    useGame.setState({
      submission: {
        status: 'done',
        rank: response.rank,
        newAchievements: response.newAchievements,
      },
    });
  } catch (error) {
    useGame.setState({
      submission: {
        status: 'error',
        code: error instanceof ApiRequestError ? error.code : 'INTERNAL_ERROR',
      },
    });
  }
}

/** Mission du mode Histoire réussie : gardée avec de quoi la rejouer, envoyée au serveur. */
export async function recordMission(): Promise<void> {
  const { source, view, replayOf } = useGame.getState();
  const mission = view?.result?.mission;
  if (!source || !view || !mission?.success || replayOf !== null) return;
  const data = await source.save();
  await useStory.getState().complete(
    {
      missionId: mission.id,
      seed: view.seed,
      commands: data.commands,
      cardsVersion: source.cardsVersion,
    },
    isOnline(),
  );
}

async function rememberAchievements(ids: readonly string[]): Promise<void> {
  await pendingAchievements.add(ids);
  if (isOnline()) await pendingAchievements.sync().catch(() => undefined);
}

function onViewChange(view: GameView | null, previous: GameView | null): void {
  if (!view || !previous || view.seed !== previous.seed || view.replay) return;
  if (view.step === 'PLANNING' && previous.step !== 'PLANNING') {
    void saveGame(1).catch(() => undefined);
  }
  if (view.step === 'ENDED' && previous.step !== 'ENDED') {
    void submitScore();
    void recordMission().catch(() => undefined);
    void saves.markFinished(view.seed, isOnline()).catch(() => undefined);
    if (view.result) {
      void localScores
        .add({
          seed: view.seed,
          mode: view.mode,
          outcome: view.result.outcome,
          phaseReached: view.result.phaseReached,
          valuation: view.result.valuation,
          sprint: view.result.sprint,
          dailyDate: view.mode === 'DAILY' ? dailyDateOf(view.seed) : undefined,
        })
        .catch(() => undefined);
    }
    if (view.result?.career) recordCareer(view.result.career);
  }
  if (view.achievements.length > previous.achievements.length) {
    const fresh = view.achievements.filter((id) => !previous.achievements.includes(id));
    void rememberAchievements(fresh).catch(() => undefined);
  }
}

let installed: (() => void) | null = null;

/**
 * Branche les effets de bord (une seule fois, au démarrage de l'application). Le retour les
 * débranche et permet de les rebrancher : en développement, React (StrictMode) monte deux fois
 * l'application, et sans cela la sauvegarde automatique ne se faisait plus.
 */
export function installGameLifecycle(): () => void {
  installed ??= useGame.subscribe((state, previous) => onViewChange(state.view, previous.view));
  return () => {
    installed?.();
    installed = null;
  };
}

/** À la connexion : envoie les sauvegardes et les succès faits hors ligne. */
export async function syncOfflineProgress(): Promise<void> {
  await saves.syncPending().catch(() => 0);
  await pendingAchievements.sync().catch(() => []);
  await useStory.getState().sync();
}
