import { PHASES } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOG, ITEM_CATEGORIES, type CatalogItem, type ItemCategory } from '../../view/catalog';
import type { GameView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/** Boutique du mode construction : choisir un objet, puis le poser dans la scène. */
export function BuildPanel({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ItemCategory>('work');
  const build = useGame((s) => s.build);
  const setBuild = useGame((s) => s.setBuild);
  const openPanel = useGame((s) => s.openPanel);
  const items = CATALOG.filter((item) => item.category === category);

  return (
    <div className="build-panel">
      <p className="hint">{t('build.intro')}</p>
      <div className="tabs" role="tablist" aria-label={t('panels.build')}>
        {ITEM_CATEGORIES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            onClick={() => setCategory(id)}
          >
            {t(`build.categories.${id}`)}
          </button>
        ))}
      </div>
      <ul className="shop" role="tabpanel">
        {items.map((item) => (
          <li key={item.kind}>
            <ShopItem
              item={item}
              view={view}
              active={build?.kind === item.kind && !build.movingItemId}
              onPick={() => {
                setBuild({ kind: item.kind, rotation: 0, movingItemId: null });
                // Sur petit écran, on referme le panneau pour libérer la scène.
                if (window.matchMedia?.('(max-width: 1023px)').matches) openPanel(null);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Effet réel de l'objet, décrit par la simulation. */
export function ItemDescription({ item }: { item: CatalogItem }) {
  const { i18n } = useTranslation();
  return <span className="item-description">{localized(item.description, i18n.language)}</span>;
}

function ShopItem({
  item,
  view,
  active,
  onPick,
}: {
  item: CatalogItem;
  view: GameView;
  active: boolean;
  onPick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locked = PHASES.indexOf(item.minPhase) > PHASES.indexOf(view.phase);
  const tooExpensive = view.gauges.treasury < item.price;
  const soldOut = view.items.filter((placed) => placed.kind === item.kind).length >= item.maxCount;
  return (
    <button
      type="button"
      className={`shop-item ${active ? 'active' : ''}`}
      disabled={locked || tooExpensive || soldOut}
      aria-pressed={active}
      onClick={onPick}
    >
      <span className="shop-item-name">{localized(item.name, i18n.language)}</span>
      <span className="shop-item-price">
        {t('build.price', { price: formatMoney(item.price, i18n.language) })}
      </span>
      {locked ? (
        <span className="locked">{t('build.locked', { phase: t(`phases.${item.minPhase}`) })}</span>
      ) : soldOut ? (
        <span className="locked">{t('build.soldOut', { max: item.maxCount })}</span>
      ) : (
        <ItemDescription item={item} />
      )}
    </button>
  );
}
