import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import { layoutOf } from '../../view/layout';
import { checkPlacement } from '../../view/placement';
import type { GameView } from '../../view/types';
import { formatGauge, formatMoney, localized } from '../game/format';
import { useGame, type BuildState } from '../store/game';
import { Catalog, ItemThumbnail } from './Catalog';
import { ColorPicker } from './ColorPicker';
import { SelectionBar } from './SelectionBar';

/**
 * Interface du mode construction. Elle remplace le HUD habituel pour dégager la scène :
 * - en haut, un bandeau : trésorerie et bouton « Terminer » ;
 * - en bas, soit le catalogue (rien en main), soit la barre de pose (objet en main), le
 *   catalogue étant alors entièrement replié.
 */
export function BuildMode({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const build = useGame((s) => s.build);
  const selected = useGame((s) => s.selected);
  const exitBuild = useGame((s) => s.exitBuild);
  if (!build) return null;

  return (
    <div className="build-hud" data-testid="build-mode">
      <header className="build-top">
        <p className="build-title">
          <span aria-hidden="true">⚒</span> {t('build.title')}
        </p>
        <p className="build-money" data-testid="build-money">
          <span className="visually-hidden">{t('gauges.treasury.name')} : </span>
          {formatGauge('treasury', view.gauges.treasury, i18n.language)}
        </p>
        <PauseToggle view={view} />
        <button type="button" className="primary" onClick={exitBuild} aria-keyshortcuts="B">
          ✓ {t('build.done')}
        </button>
      </header>
      <div className="build-bottom">
        {build.kind ? (
          <PlacementBar view={view} build={build} />
        ) : (
          <>
            {selected?.type === 'item' ? (
              <SelectionBar view={view} />
            ) : (
              <p className="build-hint">{t('build.intro')}</p>
            )}
            <Catalog view={view} />
          </>
        )}
      </div>
    </div>
  );
}

/** Le temps continue pendant la construction : un bouton pour souffler (sauf en Hardcore). */
function PauseToggle({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  if (view.step !== 'EXECUTION' || view.mode === 'HARDCORE') return null;
  const paused = view.time.speed === 0;
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={paused ? t('build.resume') : t('build.pause')}
      title={paused ? t('build.resume') : t('build.pause')}
      onClick={() => void dispatch({ type: 'setSpeed', speed: paused ? 1 : 0 })}
    >
      {paused ? '▶' : '❚❚'}
    </button>
  );
}

/** Le pointeur principal est-il un doigt ? (le texte d'aide change) */
function coarsePointer(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/** Barre de pose : l'objet en main, si la case visée convient, tourner, annuler, poser. */
function PlacementBar({ view, build }: { view: GameView; build: BuildState }) {
  const { t, i18n } = useTranslation();
  const rotateBuild = useGame((s) => s.rotateBuild);
  const cancelPlacement = useGame((s) => s.cancelPlacement);
  const placeAt = useGame((s) => s.placeAt);
  const setBuildColor = useGame((s) => s.setBuildColor);
  const def = build.kind ? catalogItem(build.kind) : undefined;
  if (!def) return null;

  const cell = build.cell ?? null;
  const error = cell
    ? checkPlacement(layoutOf(view), view.items, {
        kind: def.kind,
        x: cell.x,
        z: cell.z,
        rotation: build.rotation,
        ignoreId: build.movingItemId ?? undefined,
      })
    : null;
  const moving = build.movingItemId !== null;
  const stock = build.fromStock
    ? view.inventory.find((s) => s.kind === build.kind && s.color === build.color)
    : undefined;
  const status = !cell
    ? t(def.accessory ? 'build.hintAccessory' : 'build.aim')
    : error
      ? t(`results.${error}`)
      : build.placed > 0
        ? t('build.again')
        : def.wall
          ? t('build.hintWall')
          : coarsePointer()
            ? t('build.hintTouch')
            : t('build.hintMouse');

  return (
    <div
      className="placement-bar"
      role="region"
      aria-label={t(moving ? 'build.moving' : 'build.placing', {
        item: localized(def.name, i18n.language),
      })}
      data-testid="placement-bar"
    >
      <ItemThumbnail item={def} />
      <div className="placement-info">
        <p className="placement-name">
          <strong>{localized(def.name, i18n.language)}</strong>
          {!moving && !build.fromStock && (
            <span className="catalog-card-price">
              {' '}
              · {t('build.price', { price: formatMoney(def.price, i18n.language) })}
            </span>
          )}
          {build.fromStock && (
            <span className="catalog-card-price" data-testid="stock-count">
              {' '}
              · {t('build.free')} {t('build.fromInventory')} ·{' '}
              {t('build.stock', { count: stock?.count ?? 0 })}
            </span>
          )}
          {build.placed > 0 && (
            <span className="placement-count" data-testid="placed-count">
              {' '}
              · {t('build.placedCount', { count: build.placed })}
            </span>
          )}
        </p>
        <p className={error ? 'placement-status invalid' : 'placement-status'} aria-live="polite">
          {error ? '✕ ' : ''}
          {status}
        </p>
      </div>
      <div className="placement-actions">
        {!moving && !build.fromStock && def.paint.length > 0 && (
          <ColorPicker value={build.color} onChange={setBuildColor} />
        )}
        <button type="button" onClick={rotateBuild} aria-keyshortcuts="R">
          ⟳ <span className="label">{t(def.wall ? 'build.switchWall' : 'build.rotate')}</span>
        </button>
        <button type="button" onClick={cancelPlacement} aria-keyshortcuts="Escape">
          ✕ <span className="label">{t('build.cancel')}</span>
        </button>
        <button
          type="button"
          className="primary"
          disabled={!cell || error !== null}
          onClick={() => void placeAt()}
          aria-keyshortcuts="Enter"
          data-testid="place"
        >
          ✓ {t(moving ? 'build.confirmMove' : 'build.confirm')}
        </button>
      </div>
    </div>
  );
}
