import { GAME_MODES, type LeaderboardEntry } from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { metaApi } from '../../api/meta';
import { formatGauge } from '../game/format';
import { useGame } from '../store/game';

/** Onglets : global, Daily du jour, puis un classement par mode (hors Daily). */
const BOARDS = ['GLOBAL', 'DAILY', ...GAME_MODES.filter((mode) => mode !== 'DAILY')] as const;
type Board = (typeof BOARDS)[number];

function boardQuery(board: Board) {
  if (board === 'GLOBAL') return {};
  if (board === 'DAILY') return { daily: 'today' };
  return { mode: board };
}

/** Classements en ligne et accès aux replays. */
export function Leaderboard() {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Board>('GLOBAL');

  return (
    <div className="leaderboard">
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
      <BoardTable key={board} board={board} />
    </div>
  );
}

/** Le tableau d'un classement, chargé depuis le serveur. */
function BoardTable({ board }: { board: Board }) {
  const { t, i18n } = useTranslation();
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
          {t('leaderboard.error')}
        </p>
      )}
      {!error && entries === null && <p aria-live="polite">{t('auth.loading')}</p>}
      {entries?.length === 0 && <p>{t('leaderboard.empty')}</p>}
      {entries && entries.length > 0 && (
        <div className="table-scroll">
          <table className="score-table">
            <caption className="visually-hidden">{t('leaderboard.title')}</caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('leaderboard.player')}</th>
                <th scope="col">{t('leaderboard.outcome')}</th>
                <th scope="col">{t('leaderboard.valuation')}</th>
                <th scope="col" className="hide-narrow">
                  {t('leaderboard.sprints')}
                </th>
                <th scope="col">
                  <span className="visually-hidden">{t('leaderboard.replay')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.rank}</td>
                  <th scope="row">{entry.pseudo}</th>
                  <td>{t(`end.outcomes.${entry.outcome}`)}</td>
                  <td>{formatGauge('treasury', entry.valuation, i18n.language)}</td>
                  <td className="hide-narrow">{entry.sprintsPlayed}</td>
                  <td>
                    <button
                      type="button"
                      disabled={loadingReplay !== null}
                      onClick={() => void watch(entry)}
                      aria-label={t('leaderboard.watch', { pseudo: entry.pseudo })}
                    >
                      ▶ <span className="hide-narrow">{t('leaderboard.replay')}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
