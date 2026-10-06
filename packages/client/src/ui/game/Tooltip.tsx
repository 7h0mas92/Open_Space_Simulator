import { useId, useState, type ReactNode } from 'react';

/**
 * Infobulle accessible : visible au survol, au focus clavier et au toucher (bascule).
 * Le texte est relié au déclencheur par `aria-describedby`.
 */
export function Tooltip({
  text,
  children,
  className,
}: {
  text: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`tooltip-host ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tooltip-trigger"
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
      >
        {children}
      </button>
      <span role="tooltip" id={id} className="tooltip" hidden={!open}>
        {text}
      </span>
    </span>
  );
}
