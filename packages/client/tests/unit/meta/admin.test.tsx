import { EVENT_CARDS, type EventCard } from '@oss/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../src/i18n';
import { CardEditor, editableCard, NEW_CARD, parseCard } from '../../../src/ui/admin/CardEditor';

const CARD: EventCard = EVENT_CARDS[0] ?? NEW_CARD;

const json = (card: unknown) => JSON.stringify(card, null, 2);

function renderEditor(props: { initial?: EventCard; isNew?: boolean; active?: boolean } = {}) {
  const onSave = vi.fn(async (_card: EventCard, _active: boolean) => undefined);
  const onCancel = vi.fn();
  render(
    <CardEditor
      initial={props.initial ?? CARD}
      isNew={props.isNew ?? false}
      active={props.active ?? true}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
  const textarea = screen.getByLabelText('Carte (JSON)');
  const type = (text: string) => fireEvent.change(textarea, { target: { value: text } });
  return { onSave, onCancel, textarea, type };
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('parseCard', () => {
  it('accepte une carte valide', () => {
    expect(parseCard(json(NEW_CARD))).toEqual({ card: NEW_CARD });
  });

  it('signale un JSON mal formé', () => {
    const result = parseCard('{ "id": ');
    expect('error' in result && result.error.length > 0).toBe(true);
  });

  it('indique le champ fautif quand le schéma refuse la carte', () => {
    const result = parseCard(json({ ...NEW_CARD, weight: 'lourd' }));
    expect(result).toEqual({ error: expect.stringMatching(/^weight : /) as unknown });
  });

  it('refuse une carte sans choix', () => {
    expect('error' in parseCard(json({ ...NEW_CARD, choices: undefined }))).toBe(true);
  });
});

describe('editableCard', () => {
  it('retire les champs gérés par le serveur', () => {
    const admin = { ...CARD, active: false, updatedAt: '2026-10-06T10:00:00.000Z' };
    expect(editableCard(admin)).toEqual(CARD);
  });
});

describe('CardEditor', () => {
  it('affiche la carte, un aperçu et l’état valide', () => {
    renderEditor();
    expect(screen.getByRole('status')).toHaveTextContent('Carte valide.');
    expect(screen.getByLabelText('Aperçu')).toHaveTextContent(CARD.title.fr);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('désactive l’enregistrement quand le JSON est invalide', () => {
    const { type, textarea } = renderEditor();
    type('{ pas du json');
    expect(screen.getByRole('status')).toHaveTextContent('Carte invalide');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(screen.queryByLabelText('Aperçu')).not.toBeInTheDocument();
  });

  it('désactive l’enregistrement quand le schéma refuse la carte', () => {
    const { type } = renderEditor();
    type(json({ ...CARD, choices: [] }));
    expect(screen.getByRole('status')).toHaveTextContent('Carte invalide : choices');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('verrouille l’identifiant d’une carte existante', () => {
    const { type } = renderEditor();
    type(json({ ...CARD, id: 'autre-id' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      "L'identifiant d'une carte existante ne peut pas changer.",
    );
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('laisse choisir l’identifiant d’une nouvelle carte', async () => {
    const { type, onSave } = renderEditor({ initial: NEW_CARD, isNew: true });
    const card = { ...NEW_CARD, id: 'canard-en-plastique-2' };
    type(json(card));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith(card, true);
  });

  it('enregistre la carte modifiée et son état actif', async () => {
    const { type, onSave } = renderEditor();
    const edited = { ...CARD, weight: 42, title: { fr: 'Nouveau titre', en: 'New title' } };
    type(json(edited));
    expect(screen.getByLabelText('Aperçu')).toHaveTextContent('Nouveau titre');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Carte active' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(edited, false);
  });

  it('annule', async () => {
    const { onCancel } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
