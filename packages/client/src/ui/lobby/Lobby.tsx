import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import { formatMoney } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Hall d'entrée » (ouvert depuis le rayon Accueil du mode construction, ou en
 * sélectionnant le comptoir) : les travaux du hall au rez-de-chaussée, les secrétaires de
 * l'accueil, puis le service de sécurité : un abonnement du modèle commun, le même que dans la
 * rubrique Abonnements.
 */

export function Lobby({ view }: { view: GameView }) {
  const { t } = useTranslation();
  return (
    <div className="servers-panel lobby-panel">
      <p className="hint">{t('lobby.intro')}</p>
      {view.lobby.built ? <Reception view={view} /> : <Build view={view} />}
    </div>
  );
}

function Build({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const { lobby } = view;
  const price = formatMoney(lobby.price, i18n.language);
  const reason =
    lobby.buildBlocker === 'LOCKED'
      ? t('build.locked', { phase: t(`phases.${lobby.minPhase}`) })
      : lobby.buildBlocker
        ? t(`results.${lobby.buildBlocker}`)
        : null;
  return (
    <section aria-labelledby="lobby-build-title">
      <h3 id="lobby-build-title" className="group-heading">
        {t('lobby.buildTitle')}
      </h3>
      <ul className="lobby-features">
        <li>🚪 {t('lobby.features.gates')}</li>
        <li>🛎️ {t('lobby.features.desk')}</li>
        <li>🛋️ {t('lobby.features.waiting')}</li>
      </ul>
      <button
        type="button"
        className="primary"
        disabled={replay || lobby.buildBlocker !== null}
        onClick={() => void dispatch({ type: 'buildLobby' })}
        data-testid="lobby-build"
      >
        🏗️ {t('lobby.build', { price })}
      </button>
      {reason && <p className="hint">{reason}</p>}
    </section>
  );
}

function Reception({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const { lobby } = view;
  const salary = formatMoney(lobby.receptionistMonthly, i18n.language);
  const locked = replay || view.step === 'PITCH';
  const set = (count: number) => void dispatch({ type: 'setReceptionists', count });
  return (
    <section aria-labelledby="lobby-reception-title">
      <h3 id="lobby-reception-title" className="group-heading">
        {t('lobby.receptionTitle')}
      </h3>
      <p className="server-state up" data-testid="lobby-built">
        ✅ {t('lobby.built')}
      </p>
      <p className="hint">{t('lobby.receptionHint', { salary })}</p>
      <div className="lobby-reception" data-testid="lobby-receptionists">
        <button
          type="button"
          disabled={locked || lobby.receptionists === 0}
          onClick={() => set(lobby.receptionists - 1)}
          aria-label={t('lobby.dismiss')}
          data-testid="lobby-dismiss"
        >
          −
        </button>
        <span aria-live="polite">
          {t('lobby.receptionists', {
            count: lobby.receptionists,
            max: lobby.maxReceptionists,
          })}
        </span>
        <button
          type="button"
          className="primary"
          disabled={locked || lobby.receptionists >= lobby.maxReceptionists}
          onClick={() => set(lobby.receptionists + 1)}
          aria-label={t('lobby.hire', { salary })}
          data-testid="lobby-hire"
        >
          +
        </button>
      </div>
      <p className="hint">
        {t('lobby.payroll', {
          price: formatMoney(lobby.receptionists * lobby.receptionistMonthly, i18n.language),
        })}
      </p>
    </section>
  );
}
