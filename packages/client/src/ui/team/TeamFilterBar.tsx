import type { DevRole } from '@oss/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERFORMANCE_GRADES, type DevView } from '../../view/types';
import {
  activeFilterCount,
  DEFAULT_TEAM_FILTERS,
  TEAM_FLAGS,
  TEAM_SORTS,
  toggle,
  type TeamFilters,
  type TeamSort,
} from './filters';

const FLAG_ICONS = {
  CONFLICT: '⚔️',
  TIRED: '😴',
  LOW_MORALE: '😞',
  REMOTE: '🏠',
  OFFICE: '🏢',
} as const;

/** Tri toujours visible, filtres combinables repliés derrière un bouton. */
export function TeamFilterBar({
  team,
  filters,
  shown,
  onChange,
}: {
  team: readonly DevView[];
  filters: TeamFilters;
  /** Nombre de devs affichés après filtrage. */
  shown: number;
  onChange: (filters: TeamFilters) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const active = activeFilterCount(filters);
  // Seuls les métiers présents dans l'équipe sont proposés (et celui déjà choisi).
  const roles = [...new Set<DevRole>(team.map((dev) => dev.role))];
  if (filters.role !== 'ALL' && !roles.includes(filters.role)) roles.push(filters.role);

  return (
    <div className="team-filters">
      <div className="team-filters-bar">
        <label className="team-sort">
          <span>{t('teamFilters.sortLabel')}</span>
          <select
            value={filters.sort}
            onChange={(event) => onChange({ ...filters, sort: event.target.value as TeamSort })}
          >
            {TEAM_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`teamFilters.sorts.${sort}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={active > 0 ? 'team-filters-toggle active' : 'team-filters-toggle'}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen(!open)}
        >
          {t('teamFilters.toggle')}
          {active > 0 && <span className="badge">{active}</span>}
        </button>
      </div>
      {open && (
        <div id={`${id}-panel`} className="team-filters-panel">
          <fieldset>
            <legend>{t('teamFilters.performance')}</legend>
            <div className="filter-chips">
              {PERFORMANCE_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  className="filter-chip grade-chip"
                  aria-pressed={filters.grades.includes(grade)}
                  title={t(`perf.grades.${grade}`)}
                  onClick={() => onChange({ ...filters, grades: toggle(filters.grades, grade) })}
                >
                  {grade}
                  <span className="visually-hidden"> : {t(`perf.grades.${grade}`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('teamFilters.situation')}</legend>
            <div className="filter-chips">
              {TEAM_FLAGS.map((flag) => (
                <button
                  key={flag}
                  type="button"
                  className="filter-chip"
                  aria-pressed={filters.flags.includes(flag)}
                  onClick={() => onChange({ ...filters, flags: toggle(filters.flags, flag) })}
                >
                  <span aria-hidden="true">{FLAG_ICONS[flag]}</span>{' '}
                  {t(`teamFilters.flags.${flag}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="team-role">
            <span>{t('teamFilters.role')}</span>
            <select
              value={filters.role}
              onChange={(event) =>
                onChange({ ...filters, role: event.target.value as DevRole | 'ALL' })
              }
            >
              <option value="ALL">{t('teamFilters.allRoles')}</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">{t('teamFilters.hint')}</p>
        </div>
      )}
      {active > 0 && (
        <p className="team-filters-result" role="status">
          <span>{t('teamFilters.result', { count: shown, total: team.length })}</span>
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_TEAM_FILTERS, sort: filters.sort })}
          >
            {t('teamFilters.reset')}
          </button>
        </p>
      )}
    </div>
  );
}
