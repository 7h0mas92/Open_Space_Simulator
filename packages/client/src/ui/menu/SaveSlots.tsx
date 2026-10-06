import type { SaveSummary } from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTOSAVE_SLOT, saves, SLOTS } from '../../save/saves';
import { formatGauge } from '../game/format';
import { saveGame } from '../store/lifecycle';
import { useGame } from '../store/game';
import { useSession } from '../store/session';

/**
 * Les 5 emplacements de sauvegarde. Au menu : charger une partie. En jeu : sauvegarder.
 * L'emplacement 1 reçoit la sauvegarde automatique de chaque début de sprint.
 */
export function SaveSlots({ mode }: { mode: 'load' | 'save' }) {
  const { t, i18n } = useTranslation();
  const online = useSession((s) => s.status === 'authenticated');
  const start = useGame((s) => s.start);
  const notify = useGame((s) => s.notify);
  const [list, setList] = useState<SaveSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Incrémenté après chaque action pour relire la liste.
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    void saves
      .list(online)
      .catch(() => [])
      .then((summaries) => !cancelled && setList(summaries));
    return () => {
      cancelled = true;
    };
  }, [online, version]);

  async function onSave(slot: number) {
    setBusy(true);
    const synced = await saveGame(slot).catch(() => null);
    setBusy(false);
    if (synced === null) notify('saves.failed', 'error');
    else notify(synced || !online ? 'saves.saved' : 'saves.savedOffline', 'success', { slot });
    refresh();
  }

  async function onLoad(slot: number) {
    setBusy(true);
    try {
      const save = await saves.load(slot, online);
      await start({ save });
    } catch {
      notify('saves.failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(slot: number) {
    if (!window.confirm(t('saves.confirmDelete', { slot }))) return;
    await saves.remove(slot, online);
    refresh();
  }

  if (list === null) return <p aria-live="polite">{t('auth.loading')}</p>;
  const bySlot = new Map(list.map((summary) => [summary.slot, summary]));
  return (
    <div className="save-slots">
      {!online && <p className="hint">{t('saves.offlineHint')}</p>}
      <ol>
        {SLOTS.map((slot) => {
          const summary = bySlot.get(slot);
          const label = slot === AUTOSAVE_SLOT ? t('saves.autoSlot') : t('saves.slot', { slot });
          return (
            <li key={slot} className="save-slot" data-testid={`save-slot-${slot}`}>
              <div>
                <strong>{label}</strong>
                {summary ? (
                  <small>
                    {t(`modes.${summary.mode}.name`)} · {t(`phases.${summary.phase}`)} ·{' '}
                    {t('saves.sprint', { sprint: summary.sprint })} ·{' '}
                    {formatGauge('treasury', summary.valuation, i18n.language)} ·{' '}
                    {new Date(summary.updatedAt).toLocaleString(i18n.language)}
                  </small>
                ) : (
                  <small>{t('saves.empty')}</small>
                )}
              </div>
              <div className="save-actions">
                {mode === 'save' && slot !== AUTOSAVE_SLOT && (
                  <button type="button" disabled={busy} onClick={() => void onSave(slot)}>
                    {t('saves.save')}
                  </button>
                )}
                {mode === 'load' && summary && (
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() => void onLoad(slot)}
                  >
                    {t('saves.load')}
                  </button>
                )}
                {summary && (
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={t('saves.delete', { slot })}
                    onClick={() => void onDelete(slot)}
                  >
                    🗑
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
