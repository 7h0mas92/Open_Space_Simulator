import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { GameView, Rotation } from '../../view/types';
import { formatMoney } from '../game/format';
import { useGame } from '../store/game';
import { moodEmoji } from '../team/StatBars';
import { EffectList } from './BuildPanel';

/**
 * Barre contextuelle au-dessus de la barre d'actions :
 * - en mode construction : objet en cours de pose, tourner, terminer ;
 * - objet sélectionné : tourner, déplacer, revendre ;
 * - dev sélectionné : aperçu et accès à sa fiche.
 */
export function SelectionBar({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const build = useGame((s) => s.build);
  const selected = useGame((s) => s.selected);
  const setBuild = useGame((s) => s.setBuild);
  const select = useGame((s) => s.select);
  const dispatch = useGame((s) => s.dispatch);
  const openPanel = useGame((s) => s.openPanel);

  if (build?.kind) {
    const rotate = () => setBuild({ ...build, rotation: ((build.rotation + 1) % 4) as Rotation });
    return (
      <div
        className="selection-bar"
        role="region"
        aria-label={t('build.placing', { item: t(`items.${build.kind}` as never) })}
      >
        <p>{t('build.placing', { item: t(`items.${build.kind}` as never) })}</p>
        <button type="button" onClick={rotate} aria-keyshortcuts="R">
          ⟳ {t('build.rotate')}
        </button>
        <button type="button" className="primary" onClick={() => setBuild(null)}>
          ✓ {t('build.cancel')}
        </button>
      </div>
    );
  }

  if (selected?.type === 'item') {
    const item = view.items.find((i) => i.id === selected.id);
    const def = item && catalogItem(item.kind);
    if (!item || !def) return null;
    return (
      <div
        className="selection-bar"
        role="region"
        aria-label={t('build.selected', { item: t(`items.${item.kind}` as never) })}
      >
        <div>
          <p>
            <strong>{t(`items.${item.kind}` as never)}</strong>
          </p>
          <EffectList item={def} />
        </div>
        <button type="button" onClick={() => dispatch({ type: 'rotateItem', itemId: item.id })}>
          ⟳ {t('build.rotate')}
        </button>
        <button
          type="button"
          onClick={() =>
            setBuild({ kind: item.kind, rotation: item.rotation, movingItemId: item.id })
          }
        >
          ✥ {t('build.move')}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (dispatch({ type: 'sellItem', itemId: item.id }).ok) select(null);
          }}
        >
          {t('build.sell', { price: formatMoney(Math.round(def.price / 2), i18n.language) })}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t('panels.close')}
          onClick={() => select(null)}
        >
          ✕
        </button>
      </div>
    );
  }

  if (selected?.type === 'dev') {
    const dev = view.devs.find((d) => d.id === selected.id);
    if (!dev) return null;
    return (
      <div className="selection-bar" role="region" aria-label={dev.name}>
        <p>
          <span aria-hidden="true">{moodEmoji(dev.morale)}</span> <strong>{dev.name}</strong> ·{' '}
          {t(`roles.${dev.role}`)} · {t(`activities.${dev.activity}`)}
        </p>
        <button type="button" className="primary" onClick={() => openPanel('team')}>
          {t('game.openProfile')}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t('panels.close')}
          onClick={() => select(null)}
        >
          ✕
        </button>
      </div>
    );
  }
  return null;
}
