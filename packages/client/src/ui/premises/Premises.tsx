/**
 * Onglet « Locaux » : un sommaire des pièces et services du bureau (hall, salle des serveurs,
 * ménage, chats, abonnements), qui n'étaient accessibles que depuis le catalogue de
 * construction ou la barre du haut. Chaque ligne ouvre le panneau détaillé.
 */
import { useTranslation } from 'react-i18next';
import { PANEL_ICONS } from '../game/Hud';
import { useGame, type PanelId } from '../store/game';

/** Panneaux ouverts depuis Locaux : leur en-tête propose une flèche retour. */
export const PREMISES_ROOMS = [
  'subscriptions',
  'lobby',
  'servers',
  'pets',
] as const satisfies readonly PanelId[];

export function Premises() {
  const { t } = useTranslation();
  const openPanel = useGame((s) => s.openPanel);
  return (
    <ul className="premises">
      {PREMISES_ROOMS.map((id) => (
        <li key={id}>
          <button type="button" data-testid={`premises-${id}`} onClick={() => openPanel(id)}>
            <span aria-hidden="true">{PANEL_ICONS[id]}</span>
            <span>
              <strong>{t(`panels.${id}`)}</strong>
              <span className="hint">{t(`premises.${id}`)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
