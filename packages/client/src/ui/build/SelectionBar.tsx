import { isProjector, PROJECTION_RANGE, RECEPTION_DESK_ID } from '@oss/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { GameView, PlacedItemView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';
import { moodEmoji } from '../team/StatBars';
import { ItemThumbnail, showCatalogTab } from './Catalog';
import { ColorPicker } from './ColorPicker';
import { monitorLabel } from './MonitorShop';
import { ComputerPicker } from './ComputerPicker';
import { researchLockedReason } from './storyLock';
import { COMPUTERS, type ComputerId } from '@oss/shared';

/** Arbre R&D : le niveau à prendre pour chaque ordinateur pas encore débloqué. */
function computerResearch(t: TFunction, view: GameView): Partial<Record<ComputerId, string>> {
  const locks: Partial<Record<ComputerId, string>> = {};
  for (const computer of COMPUTERS) {
    const reason = researchLockedReason(t, view, `computer:${computer.id}`);
    if (reason) locks[computer.id] = reason;
  }
  return locks;
}

/**
 * Barre contextuelle au-dessus de la barre d'actions (ou du catalogue en construction) :
 * - objet sélectionné : tourner, peindre, choisir l'ordinateur d'un bureau, allumer ou éteindre
 *   un projecteur, déplacer, ranger dans l'inventaire, revendre ;
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
    const projection = projectionStatus(item, view, itemName, t);
    const serverRoom = view.servers.rooms.find((room) => room.id === item.id);
    // Décor offert avec une annexe : il se déplace et se tourne, rien de plus.
    const gift = item.annexDecor !== undefined;
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
          <span className="item-description">
            {gift && item.annexDecor?.startsWith('L-')
              ? t('build.lobbyDecor')
              : gift
                ? t('build.annexDecor')
                : localized(def.description, i18n.language)}
          </span>
          {item.monitor && (
            <span className="item-description item-monitor" data-testid="selected-monitor">
              🖥️ {monitorLabel(item.monitor, t, i18n.language)}
            </span>
          )}
          {projection && (
            <span className="item-status" data-testid="projection-status">
              {projection}
            </span>
          )}
          {serverRoom && (
            <span className="item-status" data-testid="server-room-status">
              {serverRoom.missing.length > 0
                ? t('servers.statusMissing', {
                    missing: serverRoom.missing
                      .map((need) => t(`servers.needsShort.${need}`))
                      .join(', '),
                  })
                : serverRoom.level === 'overheat'
                  ? t('servers.statusOverheat')
                  : serverRoom.level === 'warm'
                    ? t('servers.statusWarm', { count: serverRoom.gear, max: serverRoom.slots })
                    : t('servers.statusRunning', {
                        count: serverRoom.gear,
                        max: serverRoom.slots,
                      })}
            </span>
          )}
        </div>
        {item.kind === RECEPTION_DESK_ID && view.lobby.built && (
          <button type="button" onClick={() => openPanel('lobby')} data-testid="open-lobby">
            🛎️ {t('lobby.open')}
          </button>
        )}
        {serverRoom && (
          <button type="button" onClick={() => openPanel('servers')} data-testid="open-servers">
            🌐 {t('servers.open')}
          </button>
        )}
        {isProjector(item.kind) && (
          <button
            type="button"
            data-testid="switch-projector"
            aria-pressed={item.on === true}
            className={item.on ? 'primary' : undefined}
            onClick={() =>
              void dispatch({ type: 'switchProjector', itemId: item.id, on: item.on !== true })
            }
          >
            {item.on ? `⏻ ${t('build.projector.switchOff')}` : `⏻ ${t('build.projector.switchOn')}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => void dispatch({ type: 'rotateItem', itemId: item.id })}
        >
          ⟳ {t('build.rotate')}
        </button>
        {!gift && def.paint.length > 0 && (
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
            research={computerResearch(t, view)}
            treasury={view.gauges.treasury}
            onChange={(computer) =>
              void dispatch({ type: 'setComputer', itemId: item.id, computer })
            }
          />
        )}
        <button type="button" onClick={() => startMove(item.id)}>
          ✥ {t('build.move')}
        </button>
        {!gift && (
          <>
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
          </>
        )}
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

/**
 * État d'un projecteur ou d'un écran déroulant, en une phrase : ce qu'il projette, ou pourquoi
 * l'écran reste enroulé. `null` pour les autres objets.
 */
function projectionStatus(
  item: PlacedItemView,
  view: GameView,
  itemName: (kind: string) => string,
  t: TFunction,
): string | null {
  if (isProjector(item.kind)) {
    if (!item.on) return t('build.projector.off');
    const pair = view.projections.find((p) => p.projector === item.id);
    const screen = pair && view.items.find((i) => i.id === pair.screen);
    return screen
      ? t('build.projector.projecting', { screen: itemName(screen.kind) })
      : t('build.projector.noScreen', { range: PROJECTION_RANGE });
  }
  if (catalogItem(item.kind)?.category === 'devices') {
    return view.projections.some((p) => p.screen === item.id)
      ? t('build.projector.unrolled')
      : t('build.projector.rolled');
  }
  return null;
}
