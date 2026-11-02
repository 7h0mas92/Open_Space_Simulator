import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevSkillsView, DevView, SkillNodeView, SprintStep } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/**
 * Onglet « Compétences » de la fiche d'un dev : points à dépenser, 3 branches (Technique,
 * Vitesse, Humain) avec le nœud de métier du profil, formations payantes, Crunch et
 * réinitialisation. Lecture seule de la GameView ; chaque action est une commande typée.
 */
export function SkillTree({
  dev,
  skills,
  step,
  treasury,
}: {
  dev: DevView;
  skills: DevSkillsView;
  step: SprintStep;
  treasury: number;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const [confirmReset, setConfirmReset] = useState(false);
  const planning = step === 'PLANNING';

  return (
    <div className="skill-tree">
      <p className="skill-points" role="status">
        {skills.available > 0
          ? t('skills.pointsAvailable', { count: skills.available })
          : t('skills.noPoints')}{' '}
        <span className="hint">{t('skills.pointsHint', { spent: skills.spent })}</span>
      </p>

      {skills.crunch.learned && (
        <div className="skill-crunch">
          <button
            type="button"
            className="primary"
            disabled={!skills.crunch.ready}
            onClick={() => void dispatch({ type: 'useCrunch', devId: dev.id })}
          >
            🔥 {skills.crunch.active ? t('skills.crunchActive') : t('skills.crunch')}
          </button>
          <span className="hint">
            {skills.crunch.active
              ? t('skills.crunchActiveHint')
              : skills.crunch.ready
                ? t('skills.crunchHint')
                : t('skills.crunchUnavailable')}
          </span>
        </div>
      )}

      <div className="skill-branches">
        {skills.branches.map(({ branch, nodes }) => (
          <section key={branch} className="skill-branch" aria-labelledby={`branch-${branch}`}>
            <h4 id={`branch-${branch}`}>{t(`skills.branches.${branch}`)}</h4>
            <ol>
              {nodes.map((node) => (
                <SkillNode key={node.id} node={node} devId={dev.id} locale={i18n.language} />
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section className="skill-trainings" aria-labelledby={`trainings-${dev.id}`}>
        <h4 id={`trainings-${dev.id}`}>{t('skills.trainings')}</h4>
        <p className="hint">
          {skills.trainedThisSprint
            ? t('skills.trainedThisSprint')
            : planning
              ? t('skills.trainingsHint')
              : t('skills.trainingsPlanningOnly')}
        </p>
        <ul>
          {skills.trainings.map((training) => (
            <li key={training.kind}>
              <button
                type="button"
                disabled={!planning || skills.trainedThisSprint || treasury < training.price}
                onClick={() =>
                  void dispatch({ type: 'trainDev', devId: dev.id, kind: training.kind })
                }
              >
                <span aria-hidden="true">{training.icon}</span>{' '}
                <strong>{localized(training.name, i18n.language)}</strong>
                <span className="skill-price">{formatMoney(training.price, i18n.language)}</span>
                <span className="hint">{localized(training.effect, i18n.language)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {skills.spent > 0 &&
        (confirmReset ? (
          <div className="confirm" role="alertdialog" aria-label={t('skills.resetConfirm')}>
            <p>
              {t('skills.resetConfirm', {
                name: dev.name,
                cost: formatMoney(skills.resetCost, i18n.language),
              })}
            </p>
            <button
              type="button"
              className="danger"
              disabled={treasury < skills.resetCost}
              onClick={() => {
                void dispatch({ type: 'resetSkills', devId: dev.id }).then(() =>
                  setConfirmReset(false),
                );
              }}
            >
              {t('team.confirm')}
            </button>
            <button type="button" onClick={() => setConfirmReset(false)}>
              {t('team.cancel')}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)}>
            ↺ {t('skills.reset', { cost: formatMoney(skills.resetCost, i18n.language) })}
          </button>
        ))}
    </div>
  );
}

function SkillNode({
  node,
  devId,
  locale,
}: {
  node: SkillNodeView;
  devId: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const name = localized(node.name, locale);
  const className = `skill-node ${node.status.toLowerCase()}${node.roleNode ? ' role-node' : ''}`;
  const body = (
    <>
      <span className="skill-icon" aria-hidden="true">
        {node.status === 'LOCKED' ? '🔒' : node.icon}
      </span>
      <span className="skill-text">
        <strong>
          {name}
          {node.roleNode && <span className="skill-tag">{t('skills.roleNode')}</span>}
          {node.active && <span className="skill-tag">{t('skills.power')}</span>}
        </strong>
        <span>{localized(node.effect, locale)}</span>
      </span>
    </>
  );
  return (
    <li>
      {node.status === 'AVAILABLE' ? (
        <button
          type="button"
          className={className}
          aria-label={t('skills.learn', { name })}
          onClick={() => void dispatch({ type: 'learnSkill', devId, skill: node.id })}
        >
          {body}
          <span className="skill-cta" aria-hidden="true">
            +1
          </span>
        </button>
      ) : (
        <div className={className}>
          {body}
          <span className="visually-hidden">
            {node.status === 'LEARNED' ? t('skills.learned') : t('skills.locked')}
          </span>
        </div>
      )}
    </li>
  );
}
