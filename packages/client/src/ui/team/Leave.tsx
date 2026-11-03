import { TEAM_LIFE } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevView, GameView } from '../../view/types';
import { formatGameDate } from '../game/format';
import { useGame } from '../store/game';

/** Icône de chaque type d'absence. */
export const ABSENCE_ICONS = { LEAVE: '🏖️', BRIDGE: '🌉', SICK: '🤒', BURNOUT: '🔥' } as const;

/** Libellé court de l'absence d'un dev pour la liste de l'équipe, ou null. */
export function useAbsenceLabel(dev: DevView): string | null {
  const { t } = useTranslation();
  const { absence } = dev;
  if (!absence) return null;
  if (absence.started) return `${ABSENCE_ICONS[absence.kind]} ${t(`leave.short.${absence.kind}`)}`;
  if (absence.week !== null)
    return `${ABSENCE_ICONS.LEAVE} ${t('leave.plannedShort', { week: absence.week + 1 })}`;
  return null;
}

/** Ponts du sprint : le joueur peut demander à toute l'équipe de venir travailler. */
export function BridgeNotice({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const life = view.teamLife;
  if (!life?.bridge || view.step !== 'PLANNING') return null;
  return (
    <div className="leave-bridge" role="note">
      <p>
        {life.bridgesRefused
          ? t('leave.bridgeRefused', { moral: TEAM_LIFE.bridgeRefusedMoral })
          : t('leave.bridge')}
      </p>
      <button
        type="button"
        onClick={() => void dispatch({ type: 'refuseBridges', refuse: !life.bridgesRefused })}
      >
        {life.bridgesRefused ? t('leave.acceptBridges') : t('leave.refuseBridges')}
      </button>
    </div>
  );
}

/** Bloc « Congés » de la fiche d'un dev : réserve, absence en cours, congés à poser. */
export function LeaveSection({ dev, view }: { dev: DevView; view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const [week, setWeek] = useState<0 | 1>(0);
  const [days, setDays] = useState(1);
  if (!view.teamLife || dev.leave === null) return null;
  const { absence } = dev;
  const planning = view.step === 'PLANNING';
  const max = Math.min(TEAM_LIFE.leaveDaysMax, Math.floor(dev.leave));
  const chosen = Math.min(days, Math.max(1, max));

  // Une réserve trop maigre ou des places déjà prises : la commande refusée s'affiche en toast.
  const book = () => void dispatch({ type: 'bookLeave', devId: dev.id, week, days: chosen });

  return (
    <section className="leave">
      <h4>{t('leave.title')}</h4>
      <p>
        {t('leave.balance', { days: Math.floor(dev.leave), max: TEAM_LIFE.leaveMax })}
        {dev.leave >= TEAM_LIFE.leaveMax && (
          <span className="leave-claim"> · {t('leave.claim')}</span>
        )}
      </p>
      {absence && (
        <p className="leave-current" role="status">
          {ABSENCE_ICONS[absence.kind]}{' '}
          {absence.started
            ? t(`leave.current.${absence.kind}`, {
                days: absence.days,
                date: formatGameDate(absence.returnDate, i18n.language),
              })
            : t('leave.planned', { week: (absence.week ?? 0) + 1, count: absence.days })}
          {planning && !absence.started && absence.kind === 'LEAVE' && (
            <button
              type="button"
              onClick={() => void dispatch({ type: 'cancelLeave', devId: dev.id })}
            >
              {t('leave.cancel')}
            </button>
          )}
        </p>
      )}
      {planning && !absence && max >= 1 && (
        <div className="leave-form">
          <label>
            {t('leave.week')}
            <select value={week} onChange={(event) => setWeek(event.target.value === '1' ? 1 : 0)}>
              <option value={0}>{t('leave.weekOption', { week: 1 })}</option>
              <option value={1}>{t('leave.weekOption', { week: 2 })}</option>
            </select>
          </label>
          <label>
            {t('leave.days')}
            <select value={chosen} onChange={(event) => setDays(Number(event.target.value))}>
              {Array.from({ length: max }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {t('leave.daysOption', { count: value })}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={book}>
            {t('leave.book')}
          </button>
        </div>
      )}
      <p className="hint">
        {planning
          ? t('leave.hint', {
              moral: TEAM_LIFE.moralPerLeaveDay,
              slots: view.teamLife.slots,
            })
          : t('leave.hintLater')}
      </p>
    </section>
  );
}
