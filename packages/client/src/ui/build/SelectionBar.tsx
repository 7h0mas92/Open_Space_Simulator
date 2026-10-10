import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { GameView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';
import { moodEmoji } from '../team/StatBars';
import { ItemThumbnail, showCatalogTab } from './Catalog';
import { ColorPicker } from './ColorPicker';
import { monitorLabel } from './MonitorShop';
import { ComputerPicker } from './ComputerPicker';

/**
 * Barre contextuelle au-dessus de la barre d'actions (ou du catalogue en construction) :
 * - objet sélectionné : tourner, peindre, choisir l'ordinateur d'un bureau, déplacer, ranger
 *   dans l'inventaire, revendre ;
 * - dev sélectionné : aperçu et accès à sa fiche.
 */
export function SelectionBar({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const selected = useGame((s) => s.selected);
  const startMove = useGame((s) => s.startMove);
  const select = useGame((s) => s.select);
  const dispatch = useGame((s) => s.dispatch);
  const openPanel = useGame((s) => s.openPanel);
  const notify = useGame((s) => s.notify);
  const building = useGame((s) => s.build !== null);
  const enterBuild = useGame((s) => s.enterBuild);

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
          {item.monitor && (
            <span className="item-description item-monitor" data-testid="selected-monitor">
              🖥️ {monitorLabel(item.monitor, t, i18n.language)}
            </span>
          )}
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
        {item.monitor && (
          <button
            type="button"
            onClick={() => {
              // Hors construction, le bouton ouvre le mode construction sur ce bureau.
              if (!building) enterBuild();
              select({ type: 'item', id: item.id });
              showCatalogTab('monitors');
            }}
            data-testid="change-monitor"
          >
            🖥️ {t('build.monitor')}
          </button>
        )}
        {item.computer && (
          <ComputerPicker
            value={item.computer}
            phase={view.phase}
            treasury={view.gauges.treasury}
            onChange={(computer) =>
              void dispatch({ type: 'setComputer', itemId: item.id, computer })
            }
          />
        )}
        <button type="button" onClick={() => startMove(item.id)}>
          ✥ {t('build.move')}
        </button>
        <button
          type="button"
          data-testid="store-item"
          onClick={() => {
            const carried = view.items.filter((i) => i.host?.id === item.id).length;
            void dispatch({ type: 'storeItem', itemId: item.id }).then((result) => {
              if (!result.ok) return;
              select(null);
              notify(carried > 0 ? 'build.storedWith' : 'build.stored', 'success', {
                item: itemName(item.kind),
                count: carried,
              });
            });
          }}
        >
          📦 {t('build.store')}
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
