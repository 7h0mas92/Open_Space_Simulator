import { PET_COAT_NAMES, PET_NEEDS } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PET_COATS, coatSwatchCss, type PetCoat } from '../../view/petCoats';
import type { GameView, PetView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Chats » (ouvert depuis l'onglet Animaux du mode construction) : ce qu'il faut pour
 * adopter, le choix de la robe, puis la liste des chats du bureau. Un chat peut être confié à
 * une famille, sans remboursement.
 */

const NEED_ICONS = { litter: '🧻', bowl: '🥣', tree: '🌳' } as const;

export function Pets({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [coat, setCoat] = useState<PetCoat>('ginger');
  const pets = view.pets;
  const price = t('build.price', { price: formatMoney(pets.price, i18n.language) });
  const full = pets.pets.length >= pets.max;
  const missing = PET_NEEDS.filter((need) => !pets.needs[need]);
  const reason =
    pets.blocker === null
      ? null
      : pets.blocker === 'NOT_ELIGIBLE'
        ? full
          ? t('pets.full', { max: pets.max })
          : t('pets.missing')
        : t(`results.${pets.blocker}`);

  return (
    <div className="pets-panel">
      <p className="hint">{t('pets.intro')}</p>

      <section aria-labelledby="pets-needs-title">
        <h3 id="pets-needs-title" className="group-heading">
          {t('pets.needsTitle')}
        </h3>
        <ul className="pet-needs" data-testid="pet-needs">
          {PET_NEEDS.map((need) => (
            <li key={need} className={pets.needs[need] ? 'up' : 'down'}>
              <span aria-hidden="true">{pets.needs[need] ? '✅' : '⬜'} </span>
              <span aria-hidden="true">{NEED_ICONS[need]} </span>
              {t(`pets.needs.${need}`)}
              <span className="visually-hidden">
                {' '}
                : {pets.needs[need] ? t('pets.placed') : t('pets.notPlaced')}
              </span>
            </li>
          ))}
        </ul>
        {missing.length > 0 && <p className="hint">{t('pets.needsHint')}</p>}
      </section>

      <section className="pet-adopt" aria-labelledby="pets-adopt-title">
        <h3 id="pets-adopt-title" className="group-heading">
          {t('pets.adoptTitle', { count: pets.pets.length, max: pets.max })}
        </h3>
        <p className="pet-effects">{t('pets.effects')}</p>
        <fieldset className="pet-coats">
          <legend>{t('pets.coat')}</legend>
          {PET_COATS.map((id) => (
            <label key={id} className={id === coat ? 'pet-coat selected' : 'pet-coat'}>
              <input
                type="radio"
                name="pet-coat"
                value={id}
                checked={id === coat}
                onChange={() => setCoat(id)}
                data-testid={`pet-coat-${id}`}
              />
              <span
                className="swatch"
                style={{ background: coatSwatchCss(id) }}
                aria-hidden="true"
              />
              {localized(PET_COAT_NAMES[id], i18n.language)}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="primary"
          disabled={replay || pets.blocker !== null}
          onClick={() => void dispatch({ type: 'adoptPet', coat })}
          data-testid="adopt-pet"
        >
          🐈 {t('pets.adopt', { price })}
        </button>
        {reason && (
          <p className="hint" data-testid="adopt-blocker">
            {reason}
          </p>
        )}
      </section>

      <section aria-labelledby="pets-list-title">
        <h3 id="pets-list-title" className="group-heading">
          {t('pets.yours')}
        </h3>
        {pets.pets.length === 0 ? (
          <p className="hint">{t('pets.none')}</p>
        ) : (
          <>
            <p className={pets.happy ? 'pet-mood up' : 'pet-mood down'} data-testid="pet-mood">
              {pets.happy ? `😺 ${t('pets.happy')}` : `😾 ${t('pets.sulking')}`}
            </p>
            <ul className="pet-list">
              {pets.pets.map((pet) => (
                <li key={pet.id}>
                  <PetCard pet={pet} disabled={replay || view.step === 'PITCH'} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function PetCard({ pet, disabled }: { pet: PetView; disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="pet-card" data-testid={`pet-${pet.id}`}>
      <span
        className="pet-avatar"
        style={{ background: coatSwatchCss(pet.coat) }}
        aria-hidden="true"
      >
        🐱
      </span>
      <div className="pet-card-info">
        <h4>{pet.name}</h4>
        <p className="hint">
          {localized(PET_COAT_NAMES[pet.coat], i18n.language)} ·{' '}
          {t('pets.adoptedAt', { sprint: pet.adoptedSprint })}
        </p>
      </div>
      {confirming ? (
        <div className="pet-card-actions">
          <p className="hint">{t('pets.rehomeWarning', { name: pet.name })}</p>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setConfirming(false);
              void dispatch({ type: 'rehomePet', petId: pet.id });
            }}
          >
            {t('pets.rehomeConfirm', { name: pet.name })}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {t('group.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          data-testid={`rehome-${pet.id}`}
        >
          🏡 {t('pets.rehome')}
        </button>
      )}
    </article>
  );
}
