import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthPanel } from '../components/AuthPanel';
import { Sheet } from '../game/Sheet';
import { useSession } from '../store/session';

/**
 * Coin du compte, en haut du menu. Invité : un bouton ouvre la connexion et l'inscription
 * dans une fenêtre (bottom sheet sur mobile). Connecté : pseudo, badge admin, déconnexion.
 */
export function AccountBar() {
  const { t } = useTranslation();
  const { status, user, logout } = useSession();

  if (status === 'loading') return null;
  if (status !== 'authenticated' || !user) return <GuestAccount />;
  return (
    <div className="account-bar" aria-label={t('menu.account')} role="group">
      <p className="welcome">
        {t('menu.welcome', { pseudo: user.pseudo })}
        {user.role === 'ADMIN' && <span className="badge">{t('menu.admin')}</span>}
      </p>
      <button type="button" onClick={() => void logout()}>
        {t('menu.logout')}
      </button>
    </div>
  );
}

/**
 * Invité : le bouton et sa fenêtre. Le composant disparaît à la connexion, ce qui ferme la
 * fenêtre et remet son état à zéro pour la prochaine déconnexion.
 */
function GuestAccount() {
  const { t } = useTranslation();
  const error = useSession((s) => s.error);
  const setError = useSession((s) => s.setError);
  const [asked, setAsked] = useState(false);
  // Une erreur de connexion (retour GitHub compris) s'affiche dans la fenêtre : elle l'ouvre.
  const open = asked || error !== null;

  return (
    <div className="account-bar">
      <button type="button" className="primary" onClick={() => setAsked(true)}>
        👤 {t('menu.signIn')}
      </button>
      {open && (
        <div className="home-sheet">
          <Sheet
            title={t('menu.account')}
            onClose={() => {
              setAsked(false);
              setError(null);
            }}
          >
            <p className="hint">{t('menu.guestHint')}</p>
            <AuthPanel />
          </Sheet>
        </div>
      )}
    </div>
  );
}
