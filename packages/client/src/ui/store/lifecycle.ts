/**
 * Effets de bord d'une partie, branchés sur le store du jeu : sauvegarde automatique à chaque
 * planification, publication du score à la fin, succès gardés pour le serveur.
 */
import type { GameView } from '../../view/types';
import { useGame } from './game';
import { useSession } from './session';

const isOnline = () => useSession.getState().status === 'authenticated';

/** Date du Daily, retrouvée dans la graine (« daily-AAAA-MM-JJ »). */
export function dailyDateOf(seed: string): string | undefined {
  return /^daily-(\d{4}-\d{2}-\d{2})$/.exec(seed)?.[1];
}

/** Sauvegarde la partie en cours dans un emplacement. Renvoie vrai si le serveur l'a reçue. */
export async function saveGame(slot: number): Promise<boolean> {
  const { source, replayOf } = useGame.getState();
  if (!source || replayOf !== null) return false;
  const [{ saves }, data] = await Promise.all([import('../../save/saves'), source.save()]);
  return saves.write(slot, data, source.cardsVersion, isOnline());
}

/** Publie le score d'une partie terminée (le serveur la rejoue pour la vérifier). */
export async function submitScore(): Promise<void> {
  const { source, view, replayOf } = useGame.getState();
  if (!source || !view?.result || replayOf !== null) return;
  if (!isOnline()) {
    useGame.setState({ submission: { status: 'guest' } });
    return;
  }
  useGame.setState({ submission: { status: 'pending' } });
  try {
    const [{ metaApi }, data] = await Promise.all([import('../../api/meta'), source.save()]);
    const response = await metaApi.submitScore({
      mode: view.mode,
      seed: view.seed,
      commands: data.commands,
      cardsVersion: source.cardsVersion,
      dailyDate: view.mode === 'DAILY' ? dailyDateOf(view.seed) : undefined,
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
    const { ApiRequestError } = await import('../../api/client');
    useGame.setState({
      submission: {
        status: 'error',
        code: error instanceof ApiRequestError ? error.code : 'INTERNAL_ERROR',
      },
    });
  }
}

async function rememberAchievements(ids: readonly string[]): Promise<void> {
  const { pendingAchievements } = await import('../../save/achievements');
  await pendingAchievements.add(ids);
  if (isOnline()) await pendingAchievements.sync().catch(() => undefined);
}

function onViewChange(view: GameView | null, previous: GameView | null): void {
  if (!view || !previous || view.seed !== previous.seed || view.replay) return;
  if (view.step === 'PLANNING' && previous.step !== 'PLANNING') {
    void saveGame(1).catch(() => undefined);
  }
  if (view.step === 'ENDED' && previous.step !== 'ENDED') void submitScore();
  if (view.achievements.length > previous.achievements.length) {
    const fresh = view.achievements.filter((id) => !previous.achievements.includes(id));
    void rememberAchievements(fresh).catch(() => undefined);
  }
}

let installed: (() => void) | null = null;

/** Branche les effets de bord (une seule fois, au démarrage de l'application). */
export function installGameLifecycle(): () => void {
  installed ??= useGame.subscribe((state, previous) => onViewChange(state.view, previous.view));
  return installed;
}

/** À la connexion : envoie les sauvegardes et les succès faits hors ligne. */
export async function syncOfflineProgress(): Promise<void> {
  const [{ saves }, { pendingAchievements }] = await Promise.all([
    import('../../save/saves'),
    import('../../save/achievements'),
  ]);
  await saves.syncPending().catch(() => 0);
  await pendingAchievements.sync().catch(() => []);
}
