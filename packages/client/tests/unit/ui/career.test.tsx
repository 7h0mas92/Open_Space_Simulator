import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../src/i18n';
import { CareerMilestones } from '../../../src/ui/career/CareerPanel';
import { careerRecords, recordCareer, starsText } from '../../../src/ui/career/records';
import type { LegendRunView } from '../../../src/view/types';

const RUN: LegendRunView = {
  legend: 'pepin',
  icon: '🍏',
  name: { fr: 'Pépin Computer', en: 'Pip Computer' },
  year: 1976,
  difficulty: 1,
  story: { fr: 'Histoire', en: 'Story' },
  twist: { fr: 'Départ', en: 'Start' },
  done: 1,
  total: 3,
  milestones: [
    {
      id: 'seed',
      label: { fr: 'Atteindre la Seed', en: 'Reach Seed' },
      status: 'DONE',
      sprint: 4,
      bySprint: 6,
      progress: null,
    },
    {
      id: 'users',
      label: { fr: 'Avoir 150 k utilisateurs', en: 'Have 150k users' },
      status: 'PENDING',
      sprint: null,
      bySprint: 16,
      progress: 0.25,
    },
    {
      id: 'end',
      label: { fr: 'Finir par une IPO', en: 'End with an IPO' },
      status: 'PENDING',
      sprint: null,
      bySprint: null,
      progress: null,
    },
  ],
};

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('fr');
});

describe('Mode Carrière : interface', () => {
  it('affiche l’état, l’échéance et la progression de chaque jalon', () => {
    render(<CareerMilestones career={RUN} />);
    expect(screen.getByText('Tenu au sprint 4')).toBeInTheDocument();
    expect(screen.getByText('Échéance : démo du sprint 16')).toBeInTheDocument();
    expect(screen.getByText('Jugé à la fin de la partie')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('garde le meilleur résultat de chaque légende sur l’appareil', () => {
    expect(careerRecords()).toEqual({});
    recordCareer({ legend: 'pepin', done: 2, total: 4, stars: 2 });
    recordCareer({ legend: 'pepin', done: 1, total: 4, stars: 1 });
    recordCareer({ legend: 'ampere', done: 0, total: 4, stars: 0 });
    expect(careerRecords()).toEqual({ pepin: 2, ampere: 0 });
    expect(starsText(2)).toBe('★★☆');
  });
});
