import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  MONITOR_ARM,
  MONITOR_MOUNTS,
  MONITOR_SIZES,
  MONITORS,
  PHASES,
  getMonitor,
  monitorEffects,
  monitorInches,
  monitorPrice,
  sameMonitor,
  type MonitorChoice,
  type MonitorDefinition,
} from '@oss/shared';
import { monitorKey } from '../../render/monitors';
import type { GameView, PlacedItemView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';
import { useThumbnail } from './thumbnails';
import { researchLockedReason } from './storyLock';

/** Écran choisi en dernier : on le retrouve en revenant sur l'onglet. */
let lastChoice: MonitorChoice = { model: 'gaming', size: 'medium', mount: 'stand' };

function remember(choice: MonitorChoice): MonitorChoice {
  lastChoice = choice;
  return choice;
}

/** Nom court d'un écran : « Écran gaming 165 Hz 27″ sur bras ». */
export function monitorLabel(choice: MonitorChoice, t: TFunction, language: string): string {
  const model = getMonitor(choice.model);
  return t('monitors.label', {
    name: model ? localized(model.name, language) : choice.model,
    inches: monitorInches(choice),
    mount: t(`monitors.on.${choice.mount}`),
  });
}

/** Ce qu'apporte un écran au dev assis devant (« +2,5 % productivité · +moral »). */
function effectSummary(choice: MonitorChoice, t: TFunction, language: string): string {
  const e = monitorEffects(choice);
  const parts: string[] = [];
  if (e.productivity !== 0)
    parts.push(
      t('monitors.effects.productivity', {
        value: (e.productivity * 100).toLocaleString(language, { maximumFractionDigits: 1 }),
      }),
    );
  if (e.quality) parts.push(t('monitors.effects.quality'));
  if (e.moral) parts.push(t('monitors.effects.moral'));
  if (e.debtPerDay) parts.push(t('monitors.effects.debt'));
  if (e.energySaving) parts.push(t('monitors.effects.energy'));
  return parts.length > 0 ? parts.join(' · ') : t('monitors.effects.none');
}

/**
 * Vignette 3D d'un écran (le même gabarit que dans la scène), ou une icône. Le cadrage remplit
 * la vignette quelle que soit la taille : on rend toujours la taille moyenne, et changer de
 * taille ne redessine pas les 5 vignettes.
 */
function MonitorThumbnail({ choice }: { choice: MonitorChoice }) {
  const image = useThumbnail(monitorKey('desk', { ...choice, size: 'medium' }));
  return (
    <span className="item-thumb" aria-hidden="true">
      {image ? <img src={image} alt="" draggable={false} /> : '🖥️'}
    </span>
  );
}

const phaseIndex = (phase: GameView['phase']) => PHASES.indexOf(phase);

/**
 * Rayon « Écrans » du mode construction : l'écran ne fait plus partie du bureau. On choisit un
 * modèle, sa taille et sa fixation (pied ou bras articulé), puis on l'installe sur le bureau
 * sélectionné, ou sur tous les postes d'un coup. L'ancien écran est repris à moitié prix.
 */
export function MonitorShop({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const selected = useGame((s) => s.selected);
  const [choice, setChoice] = useState<MonitorChoice>(lastChoice);
  const choose = (next: Partial<MonitorChoice>) => {
    setChoice(remember({ ...choice, ...next }));
  };
  const language = i18n.language;
  const money = (value: number) => formatMoney(value, language);
  const model = getMonitor(choice.model) ?? MONITORS[0];
  if (!model) return null;
  // Arbre R&D (Histoire) : le modèle choisi, et le bras articulé s'il est demandé.
  const researchLock =
    researchLockedReason(t, view, `monitor:${model.id}`) ??
    (choice.mount === 'arm' ? researchLockedReason(t, view, 'monitor:arm') : null);
  const locked = phaseIndex(view.phase) < phaseIndex(model.minPhase) || researchLock !== null;
  const price = monitorPrice(choice);

  const stations = view.items.filter(
    (item): item is PlacedItemView & { monitor: MonitorChoice } => item.monitor !== undefined,
  );
  const desk =
    selected?.type === 'item' ? stations.find((item) => item.id === selected.id) : undefined;
  const todo = stations.filter((item) => !sameMonitor(item.monitor, choice));
  const install = (items: readonly PlacedItemView[]) => {
    void (async () => {
      for (const item of items) {
        const result = await dispatch({ type: 'setMonitor', itemId: item.id, monitor: choice });
        if (!result.ok) break;
      }
    })();
  };
  const installed = desk ? sameMonitor(desk.monitor, choice) : false;

  return (
    <div className="walls-panel monitors-panel" role="tabpanel" data-testid="monitors">
      <div className="wall-zones" role="group" aria-label={t('monitors.size')}>
        {MONITOR_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className="wall-zone"
            aria-pressed={choice.size === size}
            aria-label={t('monitors.sizeLabel', { inches: monitorInches({ ...choice, size }) })}
            onClick={() => choose({ size })}
            data-testid={`monitor-size-${size}`}
          >
            {monitorInches({ ...choice, size })}″
          </button>
        ))}
        {MONITOR_MOUNTS.map((mount) => (
          <button
            key={mount}
            type="button"
            className="wall-zone"
            aria-pressed={choice.mount === mount}
            onClick={() => choose({ mount })}
            data-testid={`monitor-mount-${mount}`}
          >
            {t(`monitors.mounts.${mount}`)}
            {mount === 'arm' && researchLockedReason(t, view, 'monitor:arm') && (
              <span aria-hidden="true"> 🔬</span>
            )}
            {mount === 'arm' && (
              <span className="catalog-card-price">
                {' '}
                +{t('build.price', { price: money(MONITOR_ARM.price) })}
              </span>
            )}
          </button>
        ))}
      </div>
      {researchLock && (
        <p className="wall-zones-title catalog-card-text locked" data-testid="monitor-research">
          {researchLock}
        </p>
      )}
      <div className="wall-zones" role="group" aria-label={t('monitors.where')}>
        {desk && (
          <button
            type="button"
            className="wall-zone primary"
            disabled={locked || installed || view.gauges.treasury < price}
            onClick={() => install([desk])}
            data-testid="monitor-install"
          >
            {installed ? t('monitors.installed') : t('monitors.install', { price: money(price) })}
          </button>
        )}
        {stations.length > 0 && (
          <button
            type="button"
            className="wall-zone"
            disabled={locked || todo.length === 0 || view.gauges.treasury < price * todo.length}
            onClick={() => install(todo)}
            data-testid="monitor-install-all"
          >
            {t('monitors.all', { count: todo.length, price: money(price * todo.length) })}
          </button>
        )}
      </div>
      <p className="wall-zones-title monitor-hint" data-testid="monitor-current">
        {desk
          ? t('monitors.current', { monitor: monitorLabel(desk.monitor, t, language) })
          : t('monitors.pickDesk')}
      </p>
      <ul className="catalog-items" aria-label={t('build.categories.monitors')}>
        {MONITORS.map((m) => (
          <li key={m.id}>
            <MonitorCard
              model={m}
              choice={{ ...choice, model: m.id }}
              pressed={m.id === choice.model}
              locked={phaseIndex(view.phase) < phaseIndex(m.minPhase)}
              research={researchLockedReason(t, view, `monitor:${m.id}`)}
              onPick={() => choose({ model: m.id })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonitorCard({
  model,
  choice,
  pressed,
  locked,
  research,
  onPick,
}: {
  model: MonitorDefinition;
  choice: MonitorChoice;
  pressed: boolean;
  locked: boolean;
  /** Arbre R&D : le niveau à prendre, ou null. */
  research: string | null;
  onPick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  return (
    <button
      type="button"
      className="catalog-card"
      aria-pressed={pressed}
      onClick={onPick}
      data-testid={`monitor-${model.id}`}
    >
      <MonitorThumbnail choice={choice} />
      <span className="catalog-card-name">{localized(model.name, language)}</span>
      <span className="catalog-card-meta">
        <span className="catalog-card-price">
          {t('build.price', { price: formatMoney(monitorPrice(choice), language) })}
        </span>
        <span className="catalog-card-owned">{monitorInches(choice)}″</span>
      </span>
      <span className={locked || research ? 'catalog-card-text locked' : 'catalog-card-text'}>
        {research
          ? research
          : locked
            ? t('build.locked', { phase: t(`phases.${model.minPhase}`) })
            : `${effectSummary(choice, t, language)} · ${localized(model.description, language)}`}
      </span>
    </button>
  );
}
