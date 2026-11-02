import {
  MENU_MODES,
  isEndless,
  utcDate,
  type GameMode,
  type LeaderboardEntry,
  type Outcome,
} from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaApi } from '../../api/meta';
import { localScores, type LocalBoard } from '../../save/localScores';
import { formatGauge } from '../game/format';
import { useGame } from '../store/game';
import { useSession } from '../store/session';

/** Onglets : global, Daily du jour, puis un classement par mode (hors Daily). */
const BOARDS = ['GLOBAL', 'DAILY', ...MENU_MODES.filter((mode) => mode !== 'DAILY')] as const;
type Board = (typeof BOARDS)[number];

/** D'où vient le classement : le serveur (tous les joueurs) ou cet appareil. */
type Source = 'online' | 'local';

function boardQuery(board: Board) {
  if (board === 'GLOBAL') return {};
  if (board === 'DAILY') return { daily: 'today' };
  return { mode: board };
}

function localBoard(board: Board): LocalBoard {
  if (board === 'GLOBAL') return { kind: 'global' };
  if (board === 'DAILY') return { kind: 'daily', date: utcDate(new Date()) };
  return { kind: 'mode', mode: board };
}

/** Une ligne du tableau, qu'elle vienne du serveur ou de l'appareil. */
interface Row {
  readonly id: string;
  readonly rank: number;
  readonly company: string;
  /** Pseudo du joueur (classement en ligne seulement). */
  readonly pseudo: string | null;
  readonly mode: GameMode;
  readonly outcome: Outcome;
  readonly valuation: number;
  readonly sprintsPlayed: number;
  /** Partie du serveur : on peut la revoir. */
  readonly entry: LeaderboardEntry | null;
}

/**
 * Classement des meilleures entreprises : en ligne (tous les joueurs, scores vérifiés par le
 * serveur) ou sur cet appareil (toutes les parties terminées ici, même en invité). Ouvert depuis
 * le menu principal, ou en jeu (`inGame` : pas de replay, il quitterait la partie en cours).
 */
export function Leaderboard({ inGame = false }: { inGame?: boolean }) {
  const { t } = useTranslation();
  // Connecté, le serveur répond forcément ; sans serveur, on ouvre le classement de l'appareil.
  const online = useSession((s) => s.status === 'authenticated' || s.serverAvailable);
  const [source, setSource] = useState<Source>(online ? 'online' : 'local');
  const [board, setBoard] = useState<Board>('GLOBAL');

  return (
    <div className="leaderboard">
      <div className="segmented" role="group" aria-label={t('leaderboard.sources')}>
        {(['online', 'local'] as const).map((id) => (
          <button key={id} type="button" aria-pressed={source === id} onClick={() => setSource(id)}>
            {id === 'online' ? `🌍 ${t('leaderboard.online')}` : `📱 ${t('leaderboard.local')}`}
          </button>
        ))}
      </div>
      <p className="hint">
        {source === 'online' ? t('leaderboard.onlineHint') : t('leaderboard.localHint')}
        {board !== 'GLOBAL' && board !== 'DAILY' && isEndless(board)
          ? ` ${t('leaderboard.endlessHint')}`
          : ''}
      </p>
      <div className="tabs scroll-tabs" role="tablist" aria-label={t('leaderboard.boards')}>
        {BOARDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={board === id}
            onClick={() => setBoard(id)}
          >
            {id === 'GLOBAL'
              ? t('leaderboard.global')
              : id === 'DAILY'
                ? t('leaderboard.daily')
                : t(`modes.${id}.name`)}
          </button>
        ))}
      </div>
      {/* La clé recrée le tableau (et son état de chargement) à chaque changement d'onglet. */}
      {source === 'online' ? (
        <OnlineBoard key={`online-${board}`} board={board} inGame={inGame} />
      ) : (
        <LocalBoardTable key={`local-${board}`} board={board} />
      )}
    </div>
  );
}

/** Le classement en ligne d'un onglet, chargé depuis le serveur. */
function OnlineBoard({ board, inGame }: { board: Board; inGame: boolean }) {
  const { t } = useTranslation();
  const start = useGame((s) => s.start);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [loadingReplay, setLoadingReplay] = useState<string | null>(null);
  const [replayError, setReplayError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    metaApi
      .leaderboard({ ...boardQuery(board), limit: 50 })
      .then((response) => !cancelled && setEntries(response.entries))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [board]);

  async function watch(entry: LeaderboardEntry) {
    setLoadingReplay(entry.id);
    setReplayError(false);
    try {
      const replay = await metaApi.replay(entry.id);
      await start({
        replay: {
          seed: replay.seed,
          mode: replay.score.mode,
          commands: replay.commands,
          cards: replay.cards,
          cardsVersion: replay.cardsVersion,
          unlocks: replay.unlocks,
          pseudo: replay.score.pseudo,
        },
      });
    } catch {
      setReplayError(true);
    } finally {
      setLoadingReplay(null);
    }
  }

  return (
    <>
      {replayError && (
        <p className="error" role="alert">
          {t('leaderboard.replayError')}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {t('leaderboard.offline')}
        </p>
      )}
      {!error && entries === null && <p aria-live="polite">{t('auth.loading')}</p>}
      {entries?.length === 0 && <p>{t('leaderboard.empty')}</p>}
      {entries && entries.length > 0 && (
        <ScoreTable
          board={board}
          rows={entries.map((entry) => ({ ...entry, entry }))}
          replay={
            inGame ? null : { busy: loadingReplay !== null, watch: (entry) => void watch(entry) }
          }
        />
      )}
    </>
  );
}

/** Le classement d'un onglet pour les parties terminées sur cet appareil. */
function LocalBoardTable({ board }: { board: Board }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    localScores
      .top(localBoard(board))
      .then(
        (scores) =>
          !cancelled &&
          setRows(
            scores.map((score, index) => ({
              ...score,
              rank: index + 1,
              pseudo: null,
              entry: null,
            })),
          ),
      )
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [board]);

  if (rows === null) return <p aria-live="polite">{t('auth.loading')}</p>;
  if (rows.length === 0) return <p>{t('leaderboard.localEmpty')}</p>;
  return <ScoreTable board={board} rows={rows} replay={null} />;
}

/** Le tableau : rang, entreprise (et joueur), fin, valorisation, sprints, replay. */
function ScoreTable({
  board,
  rows,
  replay,
}: {
  board: Board;
  rows: readonly Row[];
  replay: { busy: boolean; watch: (entry: LeaderboardEntry) => void } | null;
}) {
  const { t, i18n } = useTranslation();
  // En mode illimité, les sprints tenus font le classement : la colonne reste visible.
  const endless = board !== 'GLOBAL' && board !== 'DAILY' && isEndless(board);
  return (
    <div className="table-scroll">
      <table className="score-table">
        <caption className="visually-hidden">{t('leaderboard.title')}</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('leaderboard.company')}</th>
            <th scope="col" className={endless ? 'hide-narrow' : undefined}>
              {t('leaderboard.outcome')}
            </th>
            <th scope="col">{t('leaderboard.valuation')}</th>
            <th scope="col" className={endless ? undefined : 'hide-narrow'}>
              {t('leaderboard.sprints')}
            </th>
            {replay && (
              <th scope="col">
                <span className="visually-hidden">{t('leaderboard.replay')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.rank}</td>
              <th scope="row">
                <span className="score-company">{row.company}</span>
                {row.pseudo !== null && <span className="score-player">{row.pseudo}</span>}
                {board === 'GLOBAL' && row.mode !== 'NORMAL' && (
                  <span className="score-player">{t(`modes.${row.mode}.name`)}</span>
                )}
              </th>
              <td className={endless ? 'hide-narrow' : undefined}>
                {t(`end.outcomes.${row.outcome}`)}
              </td>
              <td>{formatGauge('treasury', row.valuation, i18n.language)}</td>
              <td className={endless ? undefined : 'hide-narrow'}>{row.sprintsPlayed}</td>
              {replay && (
                <td>
                  {row.entry && (
                    <button
                      type="button"
                      disabled={replay.busy}
                      onClick={() => row.entry && replay.watch(row.entry)}
                      aria-label={t('leaderboard.watch', { pseudo: row.pseudo ?? row.company })}
                    >
                      ▶ <span className="hide-narrow">{t('leaderboard.replay')}</span>
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
