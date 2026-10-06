import { EventCardSchema, type AdminCard, type EventCard } from '@oss/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localized } from '../game/format';

/** Carte vide proposée à la création. */
export const NEW_CARD: EventCard = {
  id: 'nouvelle-carte',
  title: { fr: 'Titre', en: 'Title' },
  description: { fr: 'Description', en: 'Description' },
  conditions: {},
  weight: 10,
  cooldownSprints: 3,
  choices: [
    { label: { fr: 'Choix A', en: 'Choice A' }, effects: { hype: 5 } },
    { label: { fr: 'Choix B', en: 'Choice B' }, effects: { debt: -5 } },
  ],
};

/** Retire les champs gérés par le serveur pour éditer la carte elle-même. */
export function editableCard(card: AdminCard | EventCard): EventCard {
  const { id, title, description, conditions, weight, cooldownSprints, choices } = card;
  return { id, title, description, conditions, weight, cooldownSprints, choices };
}

/** Valide le JSON saisi avec le schéma Zod partagé (le même que le serveur). */
export function parseCard(text: string): { card: EventCard } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { error: (error as Error).message };
  }
  const parsed = EventCardSchema.safeParse(raw);
  if (parsed.success) return { card: parsed.data };
  const issue = parsed.error.issues[0];
  return { error: `${issue?.path.join('.') ?? ''} : ${issue?.message ?? ''}` };
}

/** Aperçu de la carte telle que le joueur la verra. */
export function CardPreview({ card }: { card: EventCard }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="stage-screen event-card card-preview" aria-label={t('admin.preview')}>
      <p className="eyebrow">{t('event.kicker')}</p>
      <h2>{localized(card.title, i18n.language)}</h2>
      <p>{localized(card.description, i18n.language)}</p>
      <ul className="choices">
        {card.choices.map((choice, index) => (
          <li key={index} className="choice">
            <strong>{localized(choice.label, i18n.language)}</strong>
            <code>{JSON.stringify(choice.effects)}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Éditeur d'une carte : JSON validé en direct par le schéma partagé, aperçu à côté.
 * Le JSON donne accès à toutes les conditions et à tous les effets sans formulaire géant.
 */
export function CardEditor({
  initial,
  isNew,
  active: initialActive,
  onSave,
  onCancel,
}: {
  initial: EventCard;
  isNew: boolean;
  active: boolean;
  onSave: (card: EventCard, active: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);
  const result = useMemo(() => parseCard(text), [text]);
  const idChanged = 'card' in result && !isNew && result.card.id !== initial.id;

  async function save() {
    if (!('card' in result) || idChanged) return;
    setSaving(true);
    try {
      await onSave(result.card, active);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-editor">
      <div className="card-editor-form">
        <label htmlFor="card-json">{t('admin.json')}</label>
        <textarea
          id="card-json"
          spellCheck={false}
          value={text}
          rows={24}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={'error' in result}
          aria-describedby="card-json-status"
        />
        <p id="card-json-status" className={'error' in result ? 'error' : 'hint'} role="status">
          {'error' in result
            ? t('admin.invalid', { error: result.error })
            : idChanged
              ? t('admin.idLocked')
              : t('admin.valid')}
        </p>
        <label className="switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t('admin.active')}
        </label>
        <div className="stage-actions">
          <button
            type="button"
            className="primary"
            disabled={saving || 'error' in result || idChanged}
            onClick={() => void save()}
          >
            {t('admin.save')}
          </button>
          <button type="button" onClick={onCancel}>
            {t('admin.cancel')}
          </button>
        </div>
      </div>
      {'card' in result && <CardPreview card={result.card} />}
    </div>
  );
}
