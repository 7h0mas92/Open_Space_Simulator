import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Page plein écran du menu (classements, profil, succès, admin) avec un bouton retour. */
export function MetaPage({
  title,
  onBack,
  children,
  wide = false,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className={`meta-page ${wide ? 'meta-wide' : ''}`}>
      <header className="meta-header">
        <button type="button" onClick={onBack}>
          ← {t('meta.back')}
        </button>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
      </header>
      {children}
    </main>
  );
}
