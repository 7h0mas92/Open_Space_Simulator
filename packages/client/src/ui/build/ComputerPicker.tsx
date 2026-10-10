import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { COMPUTERS, PHASES, type ComputerId, type Phase } from '@oss/shared';
import { formatMoney, localized } from '../game/format';

/** Icône de chaque ordinateur dans la liste. */
const ICONS: Readonly<Record<ComputerId, string>> = {
  tower: '🖥️',
  'gaming-neon': '🌈',
  'gaming-liquid': '💧',
  'gaming-titan': '🔥',
  'pro-laptop': '💻',
};

/**
 * Choix de l'ordinateur d'un poste de travail : un bouton qui montre l'ordinateur actuel et
 * ouvre la liste des cinq (tour sobre, trois tours gaming, portable pro). Chaque choix affiche
 * son prix et son effet ; un ordinateur pas encore débloqué ou trop cher est grisé.
 *
 * La liste est rendue dans `document.body` (portail), en position fixe au-dessus du bouton : la
 * barre de sélection ne la rogne pas, et sur téléphone elle devient un panneau en haut de
 * l'écran. Le focus va sur l'ordinateur actuel à l'ouverture et revient au bouton à Échap.
 */
export function ComputerPicker({
  value,
  phase,
  treasury,
  onChange,
}: {
  value: ComputerId;
  phase: Phase;
  treasury: number;
  onChange: (computer: ComputerId) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<CSSProperties>({});
  const current = COMPUTERS.find((c) => c.id === value) ?? COMPUTERS[0];
  const refund = (current?.price ?? 0) / 2;

  // Un clic en dehors de la liste la referme.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    panel.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const toggle = () => {
    const rect = button.current?.getBoundingClientRect();
    if (rect)
      setAnchor({
        right: Math.max(8, window.innerWidth - rect.right),
        bottom: window.innerHeight - rect.top + 8,
      });
    setOpen((was) => !was);
  };
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    }
  };

  return (
    <div className="color-picker computer-picker" ref={root} onKeyDown={closeOnEscape}>
      <button
        type="button"
        aria-expanded={open}
        title={current ? localized(current.name, i18n.language) : undefined}
        ref={button}
        onClick={toggle}
        data-testid="computer-button"
      >
        <span aria-hidden="true">{ICONS[value]}</span>
        <span className="label">{t('build.computer')}</span>
      </button>
      {open &&
        createPortal(
          <div
            className="computer-options"
            role="radiogroup"
            aria-label={t('build.computer')}
            ref={panel}
            style={anchor}
            onKeyDown={closeOnEscape}
          >
            {COMPUTERS.map((computer) => {
              const locked = PHASES.indexOf(phase) < PHASES.indexOf(computer.minPhase);
              const tooExpensive = computer.id !== value && treasury + refund < computer.price;
              return (
                <button
                  key={computer.id}
                  type="button"
                  role="radio"
                  aria-checked={computer.id === value}
                  disabled={locked || tooExpensive}
                  data-testid={`computer-${computer.id}`}
                  onClick={() => {
                    onChange(computer.id);
                    setOpen(false);
                    button.current?.focus();
                  }}
                >
                  <span className="computer-icon" aria-hidden="true">
                    {ICONS[computer.id]}
                  </span>
                  <span className="computer-text">
                    <strong>{localized(computer.name, i18n.language)}</strong>
                    <small>{localized(computer.description, i18n.language)}</small>
                  </span>
                  <span className="computer-price">
                    {locked
                      ? t('build.computerLocked', { phase: t(`phases.${computer.minPhase}`) })
                      : computer.id === value
                        ? t('build.computerCurrent')
                        : computer.price === 0
                          ? t('build.computerFree')
                          : t('build.price', { price: formatMoney(computer.price, i18n.language) })}
                  </span>
                </button>
              );
            })}
            <p className="computer-note">{t('build.computerNote')}</p>
          </div>,
          document.body,
        )}
    </div>
  );
}
