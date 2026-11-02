import { BALANCE } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevView, GameView } from '../../view/types';
import { formatBirthday, formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';
import { conflictsOf, CONFLICT_AFFINITY, FRIEND_AFFINITY, filterTeam } from './filters';
import { LeadershipSummary, SpecialtyLine } from './Leadership';
import { GradeBadge, PerformancePanel, SprintProductivity, Strengths } from './Performance';
import { SkillTree } from './SkillTree';
import { moodEmoji, StatBars } from './StatBars';
import { TeamFilterBar } from './TeamFilterBar';
import { BridgeNotice, LeaveSection, useAbsenceLabel } from './Leave';
import { TeamBuilding } from './TeamBuilding';

/** Liste de l'équipe, puis fiche détaillée du dev choisi (ou sélectionné dans la scène). */
export function Team({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const filters = useGame((s) => s.teamFilters);
  const setFilters = useGame((s) => s.setTeamFilters);
  const selectedDev =
    selected?.type === 'dev' ? view.devs.find((dev) => dev.id === selected.id) : undefined;

  if (selectedDev) return <DevSheet dev={selectedDev} view={view} onBack={() => select(null)} />;
  if (view.devs.length === 0) return <p>{t('team.empty')}</p>;
  const away = view.devs.filter((dev) => dev.absence?.started).length;
  const remote = view.devs.filter(
    (dev) => dev.remoteReason !== null && !dev.absence?.started,
  ).length;
  const noDesk = view.devs.some((dev) => dev.remoteReason === 'NO_DESK');
  const shown = filterTeam(view.devs, filters);
  return (
    <>
      <p className="team-office">
        {t(view.teamLife ? 'team.officeSummaryAway' : 'team.officeSummary', {
          office: view.devs.length - remote - away,
          remote,
          away,
          desks: view.desks,
        })}
      </p>
      <BridgeNotice view={view} />
      <TeamBuilding view={view} />
      {noDesk && <p className="hint">{t('team.noDeskHint')}</p>}
      <LeadershipSummary leadership={view.leadership} />
      {view.devs.length > 1 && (
        <TeamFilterBar
          team={view.devs}
          filters={filters}
          shown={shown.length}
          onChange={setFilters}
        />
      )}
      {shown.length === 0 && <p className="hint">{t('teamFilters.empty')}</p>}
      <ul className="team-list" aria-label={t('teamFilters.listLabel')}>
        {shown.map((dev) => (
          <li key={dev.id}>
            <button
              type="button"
              className="dev-row"
              onClick={() => select({ type: 'dev', id: dev.id })}
            >
              <span className="mood" aria-hidden="true">
                {moodEmoji(dev.morale)}
              </span>
              <span className="dev-row-main">
                <strong>{dev.name}</strong>
                <span>
                  {t(`roles.${dev.role}`)}
                  <ConflictTag dev={dev} team={view.devs} />
                </span>
              </span>
              <DevRowActivity dev={dev} />
              <GradeBadge
                grade={dev.performance.grade}
                score={dev.performance.score}
                estimated={dev.performance.estimated}
              />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Ce que fait le dev : absence, télétravail ou activité au bureau. */
function DevRowActivity({ dev }: { dev: DevView }) {
  const { t } = useTranslation();
  const absence = useAbsenceLabel(dev);
  const started = dev.absence?.started === true;
  return (
    <span className="dev-row-activity">
      {dev.leavingAtSprint !== null && (
        <span className="leaving-badge">
          {t('team.leavingShort', { sprint: dev.leavingAtSprint })} ·{' '}
        </span>
      )}
      {absence && !started && <span className="leave-badge">{absence} · </span>}
      {started
        ? absence
        : dev.remoteReason
          ? `${t('team.remoteBadge')} · ${t(`remoteShort.${dev.remoteReason}`)}`
          : t(`activities.${dev.activity}`)}
      {(dev.skills?.available ?? 0) > 0 && (
        <span
          className="skill-badge"
          title={t('skills.badge', { count: dev.skills?.available ?? 0 })}
        >
          {' · '}⭐ {dev.skills?.available}
          <span className="visually-hidden">
            {t('skills.badge', { count: dev.skills?.available ?? 0 })}
          </span>
        </span>
      )}
    </span>
  );
}

/** « ⚔️ 2 » quand le dev est en conflit avec des collègues, avec leurs noms. */
function ConflictTag({ dev, team }: { dev: DevView; team: readonly DevView[] }) {
  const { t } = useTranslation();
  const conflicts = conflictsOf(dev, team);
  if (conflicts.length === 0) return null;
  const label = t('teamFilters.conflictsWith', {
    count: conflicts.length,
    names: conflicts.map((other) => other.name).join(', '),
  });
  return (
    <span className="conflict-tag" title={label}>
      {' · '}
      <span aria-hidden="true">⚔️ {conflicts.length}</span>
      <span className="visually-hidden">
        {t('teamFilters.conflicts', { count: conflicts.length })}
      </span>
    </span>
  );
}

function DevSheet({ dev, view, onBack }: { dev: DevView; view: GameView; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'sheet' | 'skills'>('sheet');

  return (
    <article className="dev-sheet" aria-labelledby={`dev-${dev.id}`}>
      <button type="button" onClick={onBack}>
        ← {t('team.back')}
      </button>
      <header>
        <h3 id={`dev-${dev.id}`}>
          {dev.name}, {t('team.age', { age: dev.age })}
        </h3>
        <p className="role">
          {t(`roles.${dev.role}`)} · {t('team.level', { level: dev.level })}
        </p>
        <p className="birthday">
          {view.calendar.birthdays.includes(dev.id)
            ? t('team.birthdayToday')
            : t('team.birthday', { date: formatBirthday(dev.birthday, i18n.language) })}
        </p>
        {dev.leavingAtSprint !== null && (
          <p className="leaving-badge" role="status">
            {t('team.leaving', { sprint: dev.leavingAtSprint })}
          </p>
        )}
        <p className="bio">{localized(dev.bio, i18n.language)}</p>
        <p className="hint">{t(`roleDescriptions.${dev.role}`)}</p>
        <SpecialtyLine dev={dev} />
      </header>
      {dev.skills && (
        <div className="tabs" role="tablist" aria-label={t('skills.tabs')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sheet'}
            onClick={() => setTab('sheet')}
          >
            {t('skills.tabSheet')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'skills'}
            onClick={() => setTab('skills')}
          >
            {t('skills.tabSkills')}
            {dev.skills.available > 0 && ` ⭐ ${dev.skills.available}`}
          </button>
        </div>
      )}
      {dev.skills && tab === 'skills' ? (
        <SkillTree dev={dev} skills={dev.skills} step={view.step} treasury={view.gauges.treasury} />
      ) : (
        <DevSheetDetails dev={dev} view={view} onBack={onBack} />
      )}
    </article>
  );
}

/** Onglet « Fiche » : performance, faits, XP, statistiques, relations, historique. */
function DevSheetDetails({
  dev,
  view,
  onBack,
}: {
  dev: DevView;
  view: GameView;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  const colleagues = view.devs.filter((other) => other.id !== dev.id);
  const { career } = dev;
  const ranked = colleagues
    .map((other) => ({ other, value: dev.relations[other.id] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const bestFriend = ranked[0] && ranked[0].value > FRIEND_AFFINITY ? ranked[0].other : null;
  const rival =
    ranked.at(-1) && (ranked.at(-1)?.value ?? 0) < CONFLICT_AFFINITY ? ranked.at(-1)?.other : null;
  return (
    <>
      <PerformancePanel performance={dev.performance} />
      <SprintProductivity performance={dev.performance} />
      <dl className="facts">
        <div>
          <dt>{t('team.activity')}</dt>
          <dd>{t(`activities.${dev.activity}`)}</dd>
        </div>
        <div>
          <dt>{t('team.workplace')}</dt>
          <dd>
            {dev.absence?.started
              ? `${t(`leave.short.${dev.absence.kind}`)}`
              : dev.remoteReason
                ? `${t('team.remoteBadge')} : ${t(`remoteReasons.${dev.remoteReason}`)}`
                : t('team.atOffice')}
          </dd>
        </div>
        <div>
          <dt>{t('team.trait')}</dt>
          <dd>{t(`traits.${dev.trait}` as never)}</dd>
        </div>
        {career && (
          <>
            <div>
              <dt>{t('team.seniority')}</dt>
              <dd>
                {t('team.seniorityValue', {
                  count: career.sprintsInTeam,
                  sprint: career.hiredAtSprint,
                })}
              </dd>
            </div>
            <div>
              <dt>{t('team.tasksDone')}</dt>
              <dd>{career.tasksDone}</dd>
            </div>
            <div>
              <dt>{t('team.currentTask')}</dt>
              <dd>
                {career.currentTask
                  ? localized(career.currentTask, i18n.language)
                  : t('team.noTask')}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>{t('team.mood')}</dt>
          <dd>
            {moodEmoji(dev.morale)} {Math.round(dev.morale)}/100
          </dd>
        </div>
        <div>
          <dt>{t('team.energy')}</dt>
          <dd>{Math.round(dev.energy)}/100</dd>
        </div>
        <div>
          <dt>{t('gauges.treasury.name')}</dt>
          <dd>{t('team.salary', { salary: formatMoney(dev.salary, i18n.language) })}</dd>
        </div>
      </dl>
      {dev.remoteReason && dev.remoteReason !== 'GHOST' && (
        <p className="hint">
          {t('team.remoteHint', {
            productivity: Math.round(BALANCE.remote.productivityPenalty * 100),
            quality: Math.round(BALANCE.remote.qualityPenalty * 100),
          })}
        </p>
      )}
      <p className="hint">{t(`traitDescriptions.${dev.trait}`)}</p>
      <LeaveSection dev={dev} view={view} />
      {career && (
        <div className="xp">
          <span>
            {t('team.level', { level: dev.level })} ·{' '}
            {t('team.xp', { xp: Math.floor(career.xp), next: career.xpToNext })}
          </span>
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (career.xp / career.xpToNext) * 100)}%` }} />
          </span>
        </div>
      )}
      <StatBars stats={dev.stats} />
      <Strengths stats={dev.stats} />
      {colleagues.length > 0 && (
        <section>
          <h4>{t('team.relations')}</h4>
          {(bestFriend || rival) && (
            <p className="hint">
              {bestFriend && t('team.bestFriend', { name: bestFriend.name })}
              {bestFriend && rival && ' · '}
              {rival && t('team.rival', { name: rival.name })}
            </p>
          )}
          <ul className="relations">
            {colleagues.map((other) => {
              const value = dev.relations[other.id] ?? 0;
              const kind =
                value > FRIEND_AFFINITY
                  ? 'friend'
                  : value < CONFLICT_AFFINITY
                    ? 'enemy'
                    : 'neutral';
              return (
                <li key={other.id} className={`relation ${kind}`}>
                  <span>{other.name}</span>
                  <span>
                    {t(`team.${kind}`)} ({value > 0 ? '+' : ''}
                    {Math.round(value)})
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h4>{t('team.history')}</h4>
        <ul className="history">
          {dev.history.length === 0 && <li>{t('team.noHistory')}</li>}
          {dev.history.map((entry, index) => (
            <li key={index}>
              <span className="tag">{t('team.sprint', { sprint: entry.sprint })}</span>{' '}
              {localized(entry.text, i18n.language)}
            </li>
          ))}
        </ul>
      </section>
      {confirming ? (
        <div
          className="confirm"
          role="alertdialog"
          aria-label={t('team.confirmFire', { name: dev.name })}
        >
          <p>{t('team.confirmFire', { name: dev.name })}</p>
          <button
            type="button"
            className="danger"
            onClick={() => {
              void dispatch({ type: 'fire', devId: dev.id }).then((result) => {
                if (result.ok) onBack();
              });
            }}
          >
            {t('team.confirm')}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {t('team.cancel')}
          </button>
        </div>
      ) : (
        <button type="button" className="danger" onClick={() => setConfirming(true)}>
          {t('team.fire')}
        </button>
      )}
    </>
  );
}
