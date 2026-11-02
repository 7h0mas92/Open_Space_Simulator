import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
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
import { MonitorShop } from './MonitorShop';
import { FloorShop } from './FloorShop';
import { WallFinishes } from './WallFinishes';
import { storyLockedReason } from './storyLock';

/** Icône de chaque rayon (et de ses objets tant que leur vignette 3D n'est pas prête). */
export const CATEGORY_ICONS: Record<ItemCategory, string> = {
  work: '💻',
  comfort: '🛋️',
  kitchen: '🍽️',
  appliance: '☕',
  fun: '🎮',
  decor: '🪴',
  pets: '🐈',
  partition: '🧱',
  window: '🪟',
  accessory: '🦆',
  devices: '📽️',
  servers: '🗄️',
  lobby: '🛎️',
};

/**
 * Onglets du catalogue : les rayons de la boutique, le rayon Écrans (juste après le travail),
 * le rayon Murs (peintures et papiers peints, juste après les fenêtres), le rayon Sols, puis
 * l'inventaire.
 */
type CatalogTab = ItemCategory | 'monitors' | 'walls' | 'floors' | 'inventory';
const TABS: readonly CatalogTab[] = ITEM_CATEGORIES.flatMap((category): CatalogTab[] =>
  category === 'window'
    ? [category, 'walls', 'floors']
    : category === 'work'
      ? [category, 'monitors']
      : [category],
).concat('inventory');

type SpecialTab = 'monitors' | 'walls' | 'floors' | 'inventory';
const TAB_ICONS: Record<SpecialTab, string> = {
  monitors: '🖥️',
  walls: '🎨',
  floors: '🟫',
  inventory: '📦',
};
const isSpecial = (tab: CatalogTab): tab is SpecialTab => tab in TAB_ICONS;

/**
 * Onglet ouvert : on y revient après chaque pose. La barre de sélection d'un bureau peut
 * ouvrir directement le rayon Écrans.
 */
const useCatalogTab = create<{ tab: CatalogTab }>(() => ({ tab: 'work' }));

export function showCatalogTab(tab: CatalogTab): void {
  useCatalogTab.setState({ tab });
}

/**
 * Catalogue du mode construction, ancré en bas de l'écran. Choisir un objet le prend en main :
 * le catalogue se replie aussitôt pour laisser toute la place à la scène. Le dernier onglet,
 * l'inventaire, liste les objets rangés : on les repose gratuitement.
 */
export function Catalog({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const category = useCatalogTab((s) => s.tab);
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
            onClick={() => showCatalogTab(id)}
          >
            <span aria-hidden="true">{isSpecial(id) ? TAB_ICONS[id] : CATEGORY_ICONS[id]}</span>
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
      ) : category === 'walls' ? (
        <WallFinishes view={view} />
      ) : category === 'floors' ? (
        <FloorShop view={view} />
      ) : category === 'monitors' ? (
        <MonitorShop view={view} />
      ) : (
        <ul className="catalog-items" role="tabpanel" data-testid="catalog">
          {category === 'pets' && (
            <li>
              <AdoptCard view={view} />
            </li>
          )}
          {category === 'servers' && (
            <li>
              <FibreCard view={view} />
            </li>
          )}
          {category === 'lobby' && (
            <li>
              <LobbyCard view={view} />
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

/**
 * Rayon Serveurs : la première carte ouvre le panneau de la salle des serveurs (état des salles,
 * abonnement fibre). Elle rappelle l'offre en cours ou ce qu'il faut pour s'abonner.
 */
function FibreCard({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const openPanel = useGame((s) => s.openPanel);
  const { fibre, plans, hasBox } = view.servers;
  const current = fibre ? plans.find((plan) => plan.id === fibre.plan) : undefined;
  const cheapest = Math.min(...plans.map((plan) => plan.weeklyPrice));
  return (
    <button
      type="button"
      className="catalog-card adopt-card"
      onClick={() => openPanel('servers')}
      data-testid="catalog-fibre"
    >
      <span className="item-thumb" aria-hidden="true">
        🌐
      </span>
      <span className="catalog-card-name">{t('servers.fibreCard')}</span>
      <span className="catalog-card-meta">
        <span className="catalog-card-price">
          {t('servers.fibre.perWeek', {
            price: formatMoney(fibre?.weeklyPrice ?? cheapest, i18n.language),
          })}
        </span>
      </span>
      <span className={fibre || hasBox ? 'catalog-card-text' : 'catalog-card-text locked'}>
        {current
          ? t('servers.fibreCardCurrent', { plan: localized(current.name, i18n.language) })
          : hasBox
            ? t('servers.fibreCardReady')
            : t('servers.fibreCardMissing')}
      </span>
    </button>
  );
}

/**
 * Rayon Accueil : la première carte ouvre le panneau du hall d'entrée (travaux, secrétaires,
 * sécurité). Elle rappelle le prix des travaux, ou ce qui est en place.
 */
function LobbyCard({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const openPanel = useGame((s) => s.openPanel);
  const { lobby } = view;
  const plan = lobby.security ? lobby.plans.find((p) => p.id === lobby.security?.plan) : undefined;
  return (
    <button
      type="button"
      className="catalog-card adopt-card"
      onClick={() => openPanel('lobby')}
      data-testid="catalog-lobby"
    >
      <span className="item-thumb" aria-hidden="true">
        🛎️
      </span>
      <span className="catalog-card-name">{t('lobby.card')}</span>
      <span className="catalog-card-meta">
        <span className="catalog-card-price">
          {lobby.built
            ? t('lobby.cardBuilt')
            : t('build.price', { price: formatMoney(lobby.price, i18n.language) })}
        </span>
      </span>
      <span
        className={
          lobby.built || lobby.buildBlocker === null
            ? 'catalog-card-text'
            : 'catalog-card-text locked'
        }
      >
        {lobby.built
          ? t('lobby.cardStatus', {
              count: lobby.receptionists,
              security: plan ? localized(plan.name, i18n.language) : t('lobby.security.none'),
            })
          : lobby.buildBlocker === 'LOCKED'
            ? t('build.locked', { phase: t(`phases.${lobby.minPhase}`) })
            : t('lobby.cardBuild')}
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
    block === 'storyLocked'
      ? storyLockedReason(t, view.mode)
      : block === 'locked'
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
