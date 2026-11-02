import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COLOR_UNLOCKS } from '@oss/shared';
import { FURNITURE_COLORS, swatchCss, type FurnitureColor } from '../../view/colors';
import { useGame } from '../store/game';

const NO_UNLOCKS: readonly string[] = [];

/**
 * Nuancier du mode construction : un bouton qui montre la couleur actuelle et ouvre une grille
 * de pastilles (boutons radio de 44 px, utilisables au doigt et au clavier).
 */
export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: FurnitureColor;
  onChange: (color: FurnitureColor) => void;
  /** Texte du bouton (« Couleur » avant la pose, « Peindre » sur un objet posé). */
  label?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const colorName = t(`build.colors.${value}`);
  // Or et Néon : récompenses du mode Histoire, proposées seulement une fois débloquées.
  const unlocks = useGame((s) => s.view?.unlocks ?? NO_UNLOCKS);
  const colors = FURNITURE_COLORS.filter((color) => {
    const reward = COLOR_UNLOCKS[color];
    return reward === undefined || unlocks.includes(reward);
  });

  // Un clic en dehors du nuancier le referme.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div
      className="color-picker"
      ref={root}
      onKeyDown={(event) => {
        // Échap ferme le nuancier sans lâcher l'objet en main.
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('build.colorOf', { color: colorName })}
        title={t('build.colorOf', { color: colorName })}
        onClick={() => setOpen((current) => !current)}
        data-testid="color-button"
      >
        <span className="swatch" style={{ background: swatchCss(value) }} aria-hidden="true" />
        <span className="label">{label ?? t('build.color')}</span>
      </button>
      {open && (
        <div className="color-swatches" role="radiogroup" aria-label={t('build.color')}>
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={color === value}
              aria-label={t(`build.colors.${color}`)}
              title={t(`build.colors.${color}`)}
              className="swatch-button"
              data-testid={`color-${color}`}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
            >
              <span className="swatch" style={{ background: swatchCss(color) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
