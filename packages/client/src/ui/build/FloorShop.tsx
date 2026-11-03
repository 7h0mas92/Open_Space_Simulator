import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { researchLockedReason, storyLockedReason } from './storyLock';
import type { TFunction } from 'i18next';
import {
  FLOOR_MATERIALS,
  FLOOR_TINT_NAMES,
  floorTintAllowed,
  getFloorMaterial,
  sameFloor,
  type FloorFinish,
  type FloorMaterial,
  type FloorZone,
} from '@oss/shared';
import { drawFloorTile, FLOOR_TINT_COLORS, floorKey } from '../../view/floors';
import type { GameView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/** Sol choisi en dernier : on le retrouve en revenant sur l'onglet. */
let lastFinish: FloorFinish = { material: 'planks', tint: 'oak' };

function remember(finish: FloorFinish): FloorFinish {
  lastFinish = finish;
  return finish;
}

/** Vignettes des sols, dessinées une seule fois (le même motif que dans la scène). */
const swatches = new Map<string, string | null>();

function swatchUrl(finish: FloorFinish): string | null {
  const key = floorKey(finish);
  if (!swatches.has(key)) {
    try {
      swatches.set(key, drawFloorTile(finish)?.toDataURL() ?? null);
    } catch {
      swatches.set(key, null); // canvas indisponible (tests) : on garde la teinte de fond
    }
  }
  return swatches.get(key) ?? null;
}

/** Échantillon d'un sol : son motif dans sa teinte (`null` : le sol d'origine de la pièce). */
export function FloorSwatch({ finish, small }: { finish: FloorFinish | null; small?: boolean }) {
  const image = finish ? swatchUrl(finish) : null;
  return (
    <span
      className={
        small ? `floor-swatch small${finish ? '' : ' original'}` : 'item-thumb floor-swatch'
      }
      style={
        finish
          ? {
              backgroundColor: FLOOR_TINT_COLORS[finish.tint],
              backgroundImage: image ? `url(${image})` : undefined,
            }
          : undefined
      }
      aria-hidden="true"
    />
  );
}

/** Ce qu'apporte une matière, par pièce couverte (« +moral +hype »). */
function effectSummary(material: FloorMaterial, t: TFunction): string {
  const parts = [`+${t('walls.effects.moral')}`];
  if (material.effects.quality) parts.push(`+${t('walls.effects.quality')}`);
  if (material.effects.hypePerDay) parts.push(`+${t('walls.effects.hype')}`);
  return parts.join(' ');
}

/** Nom complet d'un sol : « Parquet en lames chêne clair ». */
export function floorLabel(finish: FloorFinish, t: TFunction, language: string): string {
  const material = getFloorMaterial(finish.material);
  return t('floors.label', {
    material: material ? localized(material.name, language) : finish.material,
    tint: localized(FLOOR_TINT_NAMES[finish.tint], language).toLocaleLowerCase(language),
  });
}

/**
 * Rayon « Sols » du mode construction : on choisit une matière (vinyle, moquette, béton ciré,
 * carrelage, parquet...), puis sa teinte, puis la pièce à refaire. L'ancien sol n'est pas
 * remboursé ; le sol change aussitôt dans la scène.
 */
export function FloorShop({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const dispatch = useGame((s) => s.dispatch);
  const [choice, setChoice] = useState<FloorFinish>(lastFinish);
  const material = getFloorMaterial(choice.material) ?? FLOOR_MATERIALS[0];
  if (!material) return null;
  const choose = (next: FloorFinish) => {
    setChoice(remember(next));
  };
  const pickMaterial = (m: FloorMaterial) =>
    choose({ material: m.id, tint: floorTintAllowed(m, choice.tint) ? choice.tint : m.tints[0] });
  const money = (value: number) => formatMoney(value, language);
  const label = floorLabel(choice, t, language);
  const locked =
    view.floors.locked.includes(material.id) ||
    view.floors.storyLocked.includes(material.id) ||
    researchLockedReason(t, view, `floor:${material.id}`) !== null;
  const todo = view.floors.zones.filter((zone) => !sameFloor(zone.finish ?? undefined, choice));
  const allPrice = todo.length * material.price;
  const cover = (zones: readonly FloorZone[]) => {
    void (async () => {
      for (const zone of zones) {
        const result = await dispatch({ type: 'coverFloor', zone, finish: choice });
        if (!result.ok) break;
      }
    })();
  };

  return (
    <div className="walls-panel floors-panel" role="tabpanel" data-testid="floors">
      <div className="wall-zones" role="group" aria-label={t('floors.tint')}>
        {material.tints.map((tint) => (
          <button
            key={tint}
            type="button"
            className="wall-zone"
            aria-pressed={choice.tint === tint}
            onClick={() => choose({ material: material.id, tint })}
            data-testid={`floor-tint-${tint}`}
          >
            <FloorSwatch finish={{ material: material.id, tint }} small />
            <span>{localized(FLOOR_TINT_NAMES[tint], language)}</span>
          </button>
        ))}
      </div>
      <p className="wall-zones-title" aria-hidden="true">
        {t('floors.applyTo', { floor: label })}
      </p>
      <div className="wall-zones" role="group" aria-label={t('floors.applyTo', { floor: label })}>
        {view.floors.zones.map(({ zone, finish: current }) => {
          const same = sameFloor(current ?? undefined, choice);
          const room = t(`floors.zones.${zone}`);
          return (
            <button
              key={zone}
              type="button"
              className="wall-zone"
              disabled={locked || same || view.gauges.treasury < material.price}
              aria-label={
                same
                  ? t('floors.alreadyLabel', { zone: room, floor: label })
                  : t('floors.applyLabel', {
                      zone: room,
                      floor: label,
                      price: money(material.price),
                    })
              }
              onClick={() => cover([zone])}
              data-testid={`floor-zone-${zone}`}
            >
              <FloorSwatch finish={current} small />
              <span>{room}</span>
              {same && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
        {view.floors.zones.length > 1 && (
          <button
            type="button"
            className="wall-zone primary"
            disabled={locked || todo.length === 0 || view.gauges.treasury < allPrice}
            onClick={() => cover(todo.map((zone) => zone.zone))}
            data-testid="floor-zone-all"
          >
            {t('floors.all', { price: money(allPrice) })}
          </button>
        )}
      </div>
      <ul className="catalog-items" aria-label={t('build.categories.floors')}>
        {FLOOR_MATERIALS.map((m) => {
          const storyLocked = view.floors.storyLocked.includes(m.id);
          const research = researchLockedReason(t, view, `floor:${m.id}`);
          const isLocked = storyLocked || research !== null || view.floors.locked.includes(m.id);
          const shown: FloorFinish = {
            material: m.id,
            tint: m.id === material.id ? choice.tint : m.tints[0],
          };
          return (
            <li key={m.id}>
              <button
                type="button"
                className="catalog-card"
                aria-pressed={m.id === material.id}
                onClick={() => pickMaterial(m)}
                data-testid={`floor-material-${m.id}`}
              >
                <FloorSwatch finish={shown} />
                <span className="catalog-card-name">{localized(m.name, language)}</span>
                <span className="catalog-card-meta">
                  <span className="catalog-card-price">
                    {t('floors.perRoom', { price: money(m.price) })}
                  </span>
                </span>
                <span className={isLocked ? 'catalog-card-text locked' : 'catalog-card-text'}>
                  {storyLocked
                    ? storyLockedReason(t, view)
                    : research
                      ? research
                      : isLocked
                        ? t('build.locked', { phase: t(`phases.${m.minPhase}`) })
                        : `${effectSummary(m, t)} · ${localized(m.description, language)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
