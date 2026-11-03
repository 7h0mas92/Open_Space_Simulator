import {
  PRESTIGE_BRANCH,
  RESEARCH,
  RESEARCH_BRANCHES,
  RESEARCH_BRANCH_INFO,
  STORY_ACTS,
  STORY_REWARDS,
  type StoryRewardId,
  type ResearchBranch,
} from '@oss/shared';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { researchKeyName } from '../../view/research';
import type { ResearchNodeView, ResearchView } from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';

type Tab = ResearchBranch | typeof PRESTIGE_BRANCH;
const TABS: readonly Tab[] = [...RESEARCH_BRANCHES, PRESTIGE_BRANCH];

/** Dernier onglet ouvert, gardé tant que la page vit (comme le rayon du catalogue). */
let lastTab: Tab = 'comfort';
function rememberTab(tab: Tab): Tab {
  lastTab = tab;
  return tab;
}

/**
 * Panneau « R&D » de l'histoire : les points d'innovation, puis une branche par onglet avec ses
 * 4 niveaux, et la branche Prestige (récompenses des objectifs). Lecture de la GameView ; la
 * simulation vérifie chaque déblocage (`RESEARCH_NODE`).
 */
export function ResearchPanel({ research }: { research: ResearchView }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>(lastTab);
  const choose = (next: Tab) => {
    setTab(rememberTab(next));
  };
  // Flèches gauche et droite entre les onglets (navigation clavier d'une liste d'onglets).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] ?? tab;
    choose(next);
    document.getElementById(`research-tab-${next}`)?.focus();
  };
  const owned = (branch: Tab) =>
    branch === PRESTIGE_BRANCH
      ? `${research.prestige.filter((p) => p.unlocked).length}/${research.prestige.length}`
      : `${research.nodes.filter((n) => n.branch === branch && n.status === 'owned').length}/4`;
  return (
    <div className="research-panel" data-testid="research-panel">
      <p className="research-points" role="status" data-testid="research-points">
        <strong>{t('research.points', { points: research.points })}</strong>
        <span className="hint">{t('research.earned', { earned: research.earned })}</span>
      </p>
      <p className="hint">
        {t('research.howTo', {
          feature: RESEARCH.perFeature,
          goal: RESEARCH.perGoal,
          rivals: RESEARCH.beatRivals,
        })}
      </p>
      <div
        className="research-tabs"
        role="tablist"
        aria-label={t('research.title')}
        onKeyDown={onKeyDown}
      >
        {TABS.map((id) => (
          <button
            key={id}
            id={`research-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="research-branch"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => choose(id)}
            data-testid={`research-tab-${id}`}
          >
            <span aria-hidden="true">{RESEARCH_BRANCH_INFO[id].icon}</span>
            <span className="research-tab-name">{t(`research.branches.${id}`)}</span>
            <small>{owned(id)}</small>
          </button>
        ))}
      </div>
      <div id="research-branch" role="tabpanel" aria-labelledby={`research-tab-${tab}`}>
        {tab === PRESTIGE_BRANCH ? (
          <PrestigeList research={research} />
        ) : (
          <ol className="research-nodes">
            {research.nodes
              .filter((node) => node.branch === tab)
              .map((node) => (
                <ResearchNodeCard key={node.id} node={node} points={research.points} />
              ))}
          </ol>
        )}
      </div>
      {tab === 'comfort' && <p className="hint">{t('research.free')}</p>}
    </div>
  );
}

function ResearchNodeCard({ node, points }: { node: ResearchNodeView; points: number }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const ended = useGame((s) => (s.view?.result ?? null) !== null);
  const act = STORY_ACTS[node.act];
  const status =
    node.status === 'act'
      ? t('research.status.act', { act: act ? localized(act.title, i18n.language) : '' })
      : node.status === 'points'
        ? t('research.status.points', { missing: node.cost - points })
        : t(`research.status.${node.status}`);
  const list = node.keys.map((key) => localized(researchKeyName(key), i18n.language)).join(', ');
  return (
    <li
      className={`research-node research-${node.status}`}
      data-testid={`research-node-${node.id}`}
    >
      <p className="research-node-head">
        <span className="research-level">{t('research.level', { level: node.level })}</span>
        <strong>{localized(node.name, i18n.language)}</strong>
      </p>
      <p className="research-unlocks">{t('research.unlocks', { list })}</p>
      {node.status === 'owned' ? (
        <p className="research-status">{status}</p>
      ) : (
        <>
          <button
            type="button"
            className="primary"
            disabled={node.status !== 'available' || ended}
            onClick={() => void dispatch({ type: 'research', nodeId: node.id })}
            data-testid={`research-take-${node.id}`}
          >
            {t('research.take', { cost: node.cost })}
          </button>
          {node.status !== 'available' && <p className="research-status hint">{status}</p>}
        </>
      )}
    </li>
  );
}

const NO_NAME = { fr: '', en: '' };
const rewardOf = (id: StoryRewardId) => STORY_REWARDS.find((reward) => reward.id === id);

function PrestigeList({ research }: { research: ResearchView }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <p className="hint">{t('research.prestigeIntro')}</p>
      <ul className="research-nodes">
        {research.prestige.map((item) => (
          <li
            key={item.reward}
            className={`research-node ${item.unlocked ? 'research-owned' : ''}`}
            data-testid={`research-prestige-${item.reward}`}
          >
            <p className="research-node-head">
              <span aria-hidden="true">{rewardOf(item.reward)?.icon} </span>
              <strong>{localized(rewardOf(item.reward)?.name ?? NO_NAME, i18n.language)}</strong>
            </p>
            <p className="research-status">
              {item.unlocked
                ? t('research.prestigeDone')
                : t('research.prestigeTodo', {
                    mission: localized(item.missionTitle, i18n.language),
                  })}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
