import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CATALOG,
  ITEM_CATEGORIES,
  catalogItem,
  type CatalogItem,
  type ItemCategory,
} from '../../view/catalog';
import { swatchCss } from '../../view/colors';
import { shopStatus } from '../../view/placement';
import type { GameView, StoredItemView } from '../../view/types';
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
  pets: '🐈',
  accessory: '🦆',
};

/** Onglets du catalogue : les rayons de la boutique, puis l'inventaire (objets rangés). */
type CatalogTab = ItemCategory | 'inventory';
const TABS: readonly CatalogTab[] = [...ITEM_CATEGORIES, 'inventory'];

/** Onglet ouvert en dernier : on y revient après chaque pose. */
let lastCategory: CatalogTab = 'work';

/**
 * Catalogue du mode construction, ancré en bas de l'écran. Choisir un objet le prend en main :
 * le catalogue se replie aussitôt pour laisser toute la place à la scène. Le dernier onglet,
 * l'inventaire, liste les objets rangés : on les repose gratuitement.
 */
export function Catalog({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CatalogTab>(lastCategory);
  const pickItem = useGame((s) => s.pickItem);
  const items = CATALOG.filter((item) => item.category === category);
  const stored = view.inventory.reduce((sum, stack) => sum + stack.count, 0);

  return (
    <section className="catalog" aria-label={t('build.catalog')}>
      <div className="catalog-tabs" role="tablist" aria-label={t('build.catalog')}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            data-testid={`catalog-tab-${id}`}
            onClick={() => {
              lastCategory = id;
              setCategory(id);
            }}
          >
            <span aria-hidden="true">{id === 'inventory' ? '📦' : CATEGORY_ICONS[id]}</span>
            <span className="catalog-tab-label">
              {t(id === 'inventory' ? 'build.inventory' : `build.categories.${id}`)}
            </span>
            {id === 'inventory' && stored > 0 && (
              <span className="catalog-tab-badge" data-testid="inventory-count">
                {stored}
              </span>
            )}
          </button>
        ))}
      </div>
      {category === 'inventory' ? (
        <Inventory view={view} />
      ) : (
        <ul className="catalog-items" role="tabpanel" data-testid="catalog">
          {category === 'pets' && (
            <li>
              <AdoptCard view={view} />
            </li>
          )}
          {items.map((item) => (
            <li key={item.kind}>
              <CatalogCard item={item} view={view} onPick={() => pickItem(item.kind)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Onglet Inventaire : une carte par pile (même objet, même couleur). Toucher la carte reprend
 * l'objet en main pour le reposer gratuitement ; le bouton du bas revend un exemplaire.
 */
function Inventory({ view }: { view: GameView }) {
  const { t } = useTranslation();
  if (view.inventory.length === 0) {
    return (
      <div className="catalog-items inventory-empty" role="tabpanel" data-testid="inventory">
        <p>{t('build.inventoryEmpty')}</p>
      </div>
    );
  }
  return (
    <ul className="catalog-items" role="tabpanel" data-testid="inventory">
      {view.inventory.map((stack) => {
        const item = catalogItem(stack.kind);
        return item ? (
          <li key={`${stack.kind}#${stack.color}`}>
            <StoredCard item={item} stack={stack} />
          </li>
        ) : null;
      })}
    </ul>
  );
}

function StoredCard({ item, stack }: { item: CatalogItem; stack: StoredItemView }) {
  const { t, i18n } = useTranslation();
  const pickStored = useGame((s) => s.pickStored);
  const dispatch = useGame((s) => s.dispatch);
  const name = localized(item.name, i18n.language);
  return (
    <div className="stored-card">
      <button
        type="button"
        className="catalog-card"
        onClick={() => pickStored(stack.kind, stack.color)}
        data-testid={`stored-${stack.kind}`}
      >
        <ItemThumbnail item={item} />
        <span className="catalog-card-name">
          {stack.color !== 'natural' && (
            <span
              className="swatch"
              style={{ background: swatchCss(stack.color) }}
              title={t(`build.colors.${stack.color}`)}
              aria-hidden="true"
            />
          )}
          {name}
        </span>
        <span className="catalog-card-meta">
          <span className="catalog-card-price">{t('build.free')}</span>
          <span className="catalog-card-owned">{t('build.stock', { count: stack.count })}</span>
        </span>
        <span className="catalog-card-text">{t('build.inventoryIntro')}</span>
      </button>
      <button
        type="button"
        className="stored-sell danger"
        aria-label={t('build.sellStored', {
          item: name,
          price: formatMoney(stack.resale, i18n.language),
        })}
        onClick={() => void dispatch({ type: 'sellStored', kind: stack.kind, color: stack.color })}
        data-testid={`sell-stored-${stack.kind}`}
      >
        {t('build.sell', { price: formatMoney(stack.resale, i18n.language) })}
      </button>
    </div>
  );
}

/**
 * Rayon Animaux : la première carte ouvre le panneau des chats (adoption, liste, départ). Elle
 * rappelle l'équipement qui manque encore avant de pouvoir adopter.
 */
function AdoptCard({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const openPanel = useGame((s) => s.openPanel);
  const pets = view.pets;
  const missing = Object.values(pets.needs).filter((placed) => !placed).length;
  return (
    <button
      type="button"
      className="catalog-card adopt-card"
      onClick={() => openPanel('pets')}
      data-testid="catalog-adopt"
    >
      <span className="item-thumb" aria-hidden="true">
        🐈
      </span>
      <span className="catalog-card-name">{t('pets.adoptCard')}</span>
      <span className="catalog-card-meta">
        <span className="catalog-card-price">
          {t('build.price', { price: formatMoney(pets.price, i18n.language) })}
        </span>
        <span className="catalog-card-owned">
          {t('build.owned', { count: pets.pets.length, max: pets.max })}
        </span>
      </span>
      <span className={missing > 0 ? 'catalog-card-text locked' : 'catalog-card-text'}>
        {missing > 0 ? t('pets.adoptCardMissing', { count: missing }) : t('pets.adoptCardReady')}
      </span>
    </button>
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
