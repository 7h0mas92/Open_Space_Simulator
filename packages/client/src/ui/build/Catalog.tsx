import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CATALOG, ITEM_CATEGORIES, type CatalogItem, type ItemCategory } from '../../view/catalog';
import { shopStatus } from '../../view/placement';
import type { GameView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';
import { useThumbnail } from './thumbnails';

/** Icône de chaque rayon (et de ses objets tant que leur vignette 3D n'est pas prête). */
export const CATEGORY_ICONS: Record<ItemCategory, string> = {
  work: '💻',
  comfort: '🛋️',
  kitchen: '☕',
  fun: '🎮',
  decor: '🪴',
};

/** Rayon ouvert en dernier : on y revient après chaque pose. */
let lastCategory: ItemCategory = 'work';

/**
 * Catalogue du mode construction, ancré en bas de l'écran. Choisir un objet le prend en main :
 * le catalogue se replie aussitôt pour laisser toute la place à la scène.
 */
export function Catalog({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ItemCategory>(lastCategory);
  const pickItem = useGame((s) => s.pickItem);
  const items = CATALOG.filter((item) => item.category === category);

  return (
    <section className="catalog" aria-label={t('build.catalog')}>
      <div className="catalog-tabs" role="tablist" aria-label={t('build.catalog')}>
        {ITEM_CATEGORIES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            onClick={() => {
              lastCategory = id;
              setCategory(id);
            }}
          >
            <span aria-hidden="true">{CATEGORY_ICONS[id]}</span>
            <span className="catalog-tab-label">{t(`build.categories.${id}`)}</span>
          </button>
        ))}
      </div>
      <ul className="catalog-items" role="tabpanel" data-testid="catalog">
        {items.map((item) => (
          <li key={item.kind}>
            <CatalogCard item={item} view={view} onPick={() => pickItem(item.kind)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Vignette 3D de l'objet, ou l'icône de son rayon. */
export function ItemThumbnail({ item }: { item: CatalogItem }) {
  const image = useThumbnail(item.kind);
  return (
    <span className="item-thumb" aria-hidden="true">
      {image ? <img src={image} alt="" draggable={false} /> : CATEGORY_ICONS[item.category]}
    </span>
  );
}

function CatalogCard({
  item,
  view,
  onPick,
}: {
  item: CatalogItem;
  view: GameView;
  onPick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { owned, block } = shopStatus(item, view);
  const reason =
    block === 'locked'
      ? t('build.locked', { phase: t(`phases.${item.minPhase}`) })
      : block === 'soldOut'
        ? t('build.soldOut', { max: item.maxCount })
        : block === 'tooExpensive'
          ? t('build.tooExpensive')
          : null;
  return (
    <button
      type="button"
      className="catalog-card"
      disabled={block !== null}
      onClick={onPick}
      data-testid={`catalog-${item.kind}`}
    >
      <ItemThumbnail item={item} />
      <span className="catalog-card-name">{localized(item.name, i18n.language)}</span>
      <span className="catalog-card-meta">
        <span className="catalog-card-price">
          {t('build.price', { price: formatMoney(item.price, i18n.language) })}
        </span>
        <span className="catalog-card-owned">
          {t('build.owned', { count: owned, max: item.maxCount })}
        </span>
      </span>
      <span className={reason ? 'catalog-card-text locked' : 'catalog-card-text'}>
        {reason ?? localized(item.description, i18n.language)}
      </span>
    </button>
  );
}
