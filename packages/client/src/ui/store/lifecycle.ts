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
import { storyCheckpoints } from '../../save/story';
import { recordCareer } from '../career/records';
import type { StoryMissionId } from '@oss/shared';
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

/**
 * Longue partie du mode Histoire : chaque objectif secondaire rempli (une mission de la
 * campagne) est gardé avec de quoi le rejouer et envoyé au serveur, comme une mission réussie.
 */
export async function recordCampaignGoals(ids: readonly StoryMissionId[]): Promise<void> {
  const { source, view, replayOf } = useGame.getState();
  if (!source || !view || replayOf !== null || ids.length === 0) return;
  const data = await source.save();
  for (const missionId of ids)
    await useStory.getState().complete(
      {
        missionId,
        seed: view.seed,
        commands: data.commands,
        cardsVersion: source.cardsVersion,
        campaign: true,
      },
      isOnline(),
    );
}

/** Actes dont le point de sauvegarde est déjà vérifié (« graine:acte »), pour ne relire qu'une fois. */
const checkpointed = new Set<string>();

/** Point de sauvegarde de l'acte en cours, pris à sa première planification. */
async function keepActCheckpoint(view: GameView): Promise<void> {
  const { source, replayOf } = useGame.getState();
  if (!source || replayOf !== null || !view.campaign) return;
  const act = view.campaign.actIndex;
  const key = `${view.seed}:${act}`;
  if (checkpointed.has(key)) return;
  checkpointed.add(key);
  if (await storyCheckpoints.has(view.seed, act)) return;
  const data = await source.save();
  await storyCheckpoints.keep(view.seed, { act, data, cardsVersion: source.cardsVersion });
}

/** Reprend un acte de la longue partie depuis son point de sauvegarde. Faux s'il n'y en a pas. */
export async function resumeAct(act: number): Promise<boolean> {
  const checkpoint = await storyCheckpoints.resume(act);
  if (!checkpoint) return false;
  checkpointed.clear();
  await useGame
    .getState()
    .start({ save: { data: checkpoint.data, cardsVersion: checkpoint.cardsVersion } });
  return true;
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
  if (view.campaign && view.step === 'PLANNING')
    void keepActCheckpoint(view).catch(() => undefined);
  if (view.campaign && previous.campaign) {
    const fresh = view.campaign.done.filter((id) => !previous.campaign?.done.includes(id));
    if (fresh.length > 0) void recordCampaignGoals(fresh).catch(() => undefined);
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
