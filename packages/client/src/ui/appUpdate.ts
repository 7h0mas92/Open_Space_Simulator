/**
 * Mise à jour du jeu installé (PWA). Après chaque déploiement, le service worker télécharge la
 * nouvelle version en arrière-plan ; sans ce module, la page déjà ouverte gardait l'ancienne et
 * le joueur ne voyait les nouveautés qu'au rechargement suivant (voire jamais, appli installée
 * restée ouverte).
 *
 * Règle : la nouvelle version s'applique (rechargement) dès que le joueur est au menu. En pleine
 * partie, on attend son retour au menu pour ne rien lui faire perdre. Le jeu vérifie aussi s'il
 * existe une nouvelle version toutes les 30 minutes et quand on revient sur l'onglet.
 */
import { registerSW } from 'virtual:pwa-register';
import { useGame } from './store/game';

/** Intervalle entre deux vérifications de mise à jour, en millisecondes. */
export const UPDATE_CHECK_MS = 30 * 60 * 1000;

export interface UpdatePolicyDeps {
  /** Une partie est-elle en cours (écran de jeu affiché) ? */
  readonly isInGame: () => boolean;
  /** Appelle `listener` au retour au menu ; renvoie de quoi se désabonner. */
  readonly onLeaveGame: (listener: () => void) => () => void;
  /** Active la nouvelle version et recharge la page. */
  readonly apply: () => void;
}

/**
 * Réaction à « une nouvelle version est prête » : appliquer tout de suite au menu, sinon au
 * retour au menu (une seule fois, même si l'annonce arrive plusieurs fois).
 */
export function createUpdatePolicy(deps: UpdatePolicyDeps): () => void {
  let waiting = false;
  return () => {
    if (!deps.isInGame()) {
      deps.apply();
      return;
    }
    if (waiting) return;
    waiting = true;
    const stop = deps.onLeaveGame(() => {
      stop();
      deps.apply();
    });
  };
}

/** Enregistre le service worker et branche la règle de mise à jour (appelé une fois au démarrage). */
export function installAppUpdates(): void {
  const onNeedRefresh = createUpdatePolicy({
    isInGame: () => useGame.getState().view !== null,
    onLeaveGame: (listener) =>
      useGame.subscribe((state, previous) => {
        if (previous.view !== null && state.view === null) listener();
      }),
    // `updateSW` n'est appelé qu'après l'enregistrement, quand il est déjà défini.
    apply: () => void updateSW(true),
  });
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh,
    // Sans service worker, le jeu marche quand même (en ligne) : on le signale seulement.
    onRegisterError: (error: unknown) => console.warn('Service worker non enregistré', error),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      };
      window.setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}
