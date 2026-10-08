import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { GameView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';
import { moodEmoji } from '../team/StatBars';
import { ItemThumbnail } from './Catalog';
import { ColorPicker } from './ColorPicker';

/**
 * Barre contextuelle au-dessus de la barre d'actions (ou du catalogue en construction) :
 * - objet sélectionné : tourner, déplacer, revendre ;
 * - dev sélectionné : aperçu et accès à sa fiche.
 */
export function SelectionBar({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const selected = useGame((s) => s.selected);
  const startMove = useGame((s) => s.startMove);
  const select = useGame((s) => s.select);
  const dispatch = useGame((s) => s.dispatch);
  const openPanel = useGame((s) => s.openPanel);

  const itemName = (kind: string) => {
    const def = catalogItem(kind);
    return def ? localized(def.name, i18n.language) : kind;
  };

  if (selected?.type === 'item') {
    const item = view.items.find((i) => i.id === selected.id);
    const def = item && catalogItem(item.kind);
    if (!item || !def) return null;
    return (
      <div
        className="selection-bar"
        role="region"
        aria-label={t('build.selected', { item: itemName(item.kind) })}
      >
        <ItemThumbnail item={def} />
        <div>
          <p>
            <strong>{itemName(item.kind)}</strong>
          </p>
          <span className="item-description">{localized(def.description, i18n.language)}</span>
        </div>
        <button
          type="button"
          onClick={() => void dispatch({ type: 'rotateItem', itemId: item.id })}
        >
          ⟳ {t('build.rotate')}
        </button>
        {def.paint.length > 0 && (
          <ColorPicker
            value={item.color}
            label={t('build.paint')}
            onChange={(color) => void dispatch({ type: 'paintItem', itemId: item.id, color })}
          />
        )}
        <button type="button" onClick={() => startMove(item.id)}>
          ✥ {t('build.move')}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            void dispatch({ type: 'sellItem', itemId: item.id }).then((result) => {
              if (result.ok) select(null);
            });
          }}
        >
          {t('build.sell', { price: formatMoney(item.resale, i18n.language) })}
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
