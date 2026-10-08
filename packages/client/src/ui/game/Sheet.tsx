import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Panneau de jeu : panneau latéral sur ordinateur, « bottom sheet » plein écran sur mobile
 * (la mise en page est faite en CSS). Échap ferme ; le focus entre dans le panneau à
 * l'ouverture et revient au bouton d'origine à la fermeture.
 */
export function Sheet({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  /** Icône décorative devant le titre (celle du bouton qui a ouvert le panneau). */
  icon?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Sans `preventScroll`, le focus pendant l'animation d'ouverture fait défiler l'écran de jeu.
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus?.();
  }, []);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="sheet-header">
          <span className="sheet-grip" aria-hidden="true" />
          {icon && (
            <span className="sheet-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={t('panels.close')}
          >
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
