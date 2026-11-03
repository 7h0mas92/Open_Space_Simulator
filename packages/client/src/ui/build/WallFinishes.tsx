import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { researchLockedReason, storyLockedReason } from './storyLock';
import type { TFunction } from 'i18next';
import { WALL_FINISHES, type WallFinish, type WallFinishId, type WallZone } from '@oss/shared';
import type { GameView } from '../../view/types';
import { drawWallTile, hasPattern, WALL_LOOKS } from '../../view/walls';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/** Revêtement choisi en dernier : on le retrouve en revenant sur l'onglet. */
let lastFinish: WallFinishId = 'sage';

/** Vignettes des papiers peints, dessinées une seule fois (le même motif que dans la scène). */
const swatches = new Map<WallFinishId, string | null>();

function swatchUrl(finish: WallFinishId): string | null {
  if (!swatches.has(finish)) {
    try {
      swatches.set(finish, drawWallTile(finish)?.toDataURL() ?? null);
    } catch {
      swatches.set(finish, null); // canvas indisponible (tests) : on garde la teinte de fond
    }
  }
  return swatches.get(finish) ?? null;
}

/** Échantillon d'un revêtement : la teinte d'une peinture, ou le motif d'un papier peint. */
export function FinishSwatch({ finish, small }: { finish: WallFinishId; small?: boolean }) {
  const image = hasPattern(finish) ? swatchUrl(finish) : null;
  return (
    <span
      className={small ? 'wall-swatch small' : 'item-thumb wall-swatch'}
      style={{
        backgroundColor: WALL_LOOKS[finish].base,
        backgroundImage: image ? `url(${image})` : undefined,
      }}
      aria-hidden="true"
    />
  );
}

/** Ce qu'apporte un revêtement, par zone couverte (« +moral +hype »). */
function effectSummary(finish: WallFinish, t: TFunction): string {
  const parts = [`+${t('walls.effects.moral')}`];
  if (finish.effects.quality) parts.push(`+${t('walls.effects.quality')}`);
  if (finish.effects.hypePerDay) parts.push(`+${t('walls.effects.hype')}`);
  return parts.join(' ');
}

/**
 * Rayon « Murs » du mode construction : on choisit une peinture ou un papier peint, puis la
 * zone de mur à couvrir (le fond ou la gauche de chaque pièce). L'ancien revêtement n'est pas
 * remboursé ; le mur change aussitôt dans la scène.
 */
export function WallFinishes({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const [selected, setSelected] = useState<WallFinishId>(lastFinish);
  const finish = WALL_FINISHES.find((f) => f.id === selected) ?? WALL_FINISHES[0];
  if (!finish) return null;
  const money = (value: number) => formatMoney(value, i18n.language);
  const name = (f: WallFinish) => localized(f.name, i18n.language);
  const locked =
    view.walls.locked.includes(finish.id) ||
    view.walls.storyLocked.includes(finish.id) ||
    researchLockedReason(t, view, `wall:${finish.id}`) !== null;
  const todo = view.walls.zones.filter((zone) => zone.finish !== finish.id);
  const allPrice = todo.length * finish.price;
  const cover = (zones: readonly WallZone[]) => {
    void (async () => {
      for (const zone of zones) {
        const result = await dispatch({ type: 'coverWall', zone, finish: finish.id });
        if (!result.ok) break;
      }
    })();
  };

  return (
    <div className="walls-panel" role="tabpanel" data-testid="walls">
      <p className="wall-zones-title" aria-hidden="true">
        {t('walls.applyTo', { finish: name(finish) })}
      </p>
      <div
        className="wall-zones"
        role="group"
        aria-label={t('walls.applyTo', { finish: name(finish) })}
      >
        {view.walls.zones.map(({ zone, finish: current }) => {
          const same = current === finish.id;
          return (
            <button
              key={zone}
              type="button"
              className="wall-zone"
              disabled={locked || same || view.gauges.treasury < finish.price}
              aria-label={
                same
                  ? t('walls.alreadyLabel', {
                      zone: t(`walls.zones.${zone}`),
                      finish: name(finish),
                    })
                  : t('walls.applyLabel', {
                      zone: t(`walls.zones.${zone}`),
                      finish: name(finish),
                      price: money(finish.price),
                    })
              }
              onClick={() => cover([zone])}
              data-testid={`wall-zone-${zone}`}
            >
              <FinishSwatch finish={current ?? 'cream'} small />
              <span>{t(`walls.zones.${zone}`)}</span>
              {same && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
        {view.walls.zones.length > 1 && (
          <button
            type="button"
            className="wall-zone primary"
            disabled={locked || todo.length === 0 || view.gauges.treasury < allPrice}
            onClick={() => cover(todo.map((zone) => zone.zone))}
            data-testid="wall-zone-all"
          >
            {t('walls.all', { price: money(allPrice) })}
          </button>
        )}
      </div>
      <ul className="catalog-items" aria-label={t('build.categories.walls')}>
        {WALL_FINISHES.map((f) => {
          const storyLocked = view.walls.storyLocked.includes(f.id);
          const research = researchLockedReason(t, view, `wall:${f.id}`);
          const isLocked = storyLocked || research !== null || view.walls.locked.includes(f.id);
          return (
            <li key={f.id}>
              <button
                type="button"
                className="catalog-card"
                aria-pressed={f.id === finish.id}
                onClick={() => {
                  lastFinish = f.id;
                  setSelected(f.id);
                }}
                data-testid={`wall-finish-${f.id}`}
              >
                <FinishSwatch finish={f.id} />
                <span className="catalog-card-name">{name(f)}</span>
                <span className="catalog-card-meta">
                  <span className="catalog-card-price">
                    {t('walls.perWall', { price: money(f.price) })}
                  </span>
                </span>
                <span className={isLocked ? 'catalog-card-text locked' : 'catalog-card-text'}>
                  {storyLocked
                    ? storyLockedReason(t, view)
                    : research
                      ? research
                      : isLocked
                        ? t('build.locked', { phase: t(`phases.${f.minPhase}`) })
                        : `${effectSummary(f, t)} · ${localized(f.description, i18n.language)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
