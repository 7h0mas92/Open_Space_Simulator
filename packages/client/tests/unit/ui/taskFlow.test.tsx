import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import i18n from '../../../src/i18n';
import { Alerts } from '../../../src/ui/game/Hud';
import { Kanban } from '../../../src/ui/kanban/Kanban';
import { useGame } from '../../../src/ui/store/game';
import { makeContext } from '../../simulation/fixtures';
import { raiseUrgent } from '../../../src/simulation/taskFlow';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

/** Une partie en plein sprint, avec une urgence ouverte et un objectif. */
function viewWithFlow() {
  const simulation = officeSimulation(SEED_OFFICE);
  const { state } = simulation;
  state.stage = 'EXECUTION';
  state.sprint = 2;
  state.sprintTick = (24 + 10 - 8) * 2; // mardi 10h
  raiseUrgent(state, makeContext(state), 'security-patch');
  state.objective = {
    kind: 'SHIP_FEATURES',
    difficulty: 'HARD',
    target: 4,
    baseline: 0,
    sprint: 2,
    reward: { treasury: 200_000, hype: 6, moral: 6 },
    status: 'ACTIVE',
    value: null,
  };
  return viewOf(simulation);
}

describe('Tâches dynamiques dans l’interface', () => {
  it('la vue expose l’urgence (échéance) et l’objectif du sprint', () => {
    const view = viewWithFlow();
    const urgent = view.tasks.find((task) => task.kind === 'URGENT');
    expect(urgent).toMatchObject({ column: 'TODO', due: { dayOfWeek: 4, hour: 10 } });
    expect(urgent?.hoursLeft).toBe(48);
    expect(view.objective).toMatchObject({ kind: 'SHIP_FEATURES', target: 4, value: 0 });
  });

  it('le Kanban montre l’objectif et l’étiquette « Urgent »', async () => {
    await act(() => i18n.changeLanguage('fr'));
    render(<Kanban view={viewWithFlow()} />);
    const objective = screen.getByTestId('sprint-objective');
    expect(within(objective).getByText('Livrer 4 features')).toBeInTheDocument();
    expect(within(objective).getByText('Difficile')).toBeInTheDocument();
    const todo = screen.getByRole('region', { name: /À faire/ });
    expect(within(todo).getByText(/Urgent/)).toBeInTheDocument();
  });

  it('le bandeau d’urgence ouvre le Kanban', async () => {
    await act(() => i18n.changeLanguage('en'));
    render(<Alerts view={viewWithFlow()} />);
    const banner = screen.getByTestId('urgent-banner');
    expect(banner).toHaveTextContent('Urgent: Patch the security hole of the day');
    await userEvent.click(banner);
    expect(useGame.getState().panel).toBe('kanban');
    await act(() => i18n.changeLanguage('fr'));
  });
});
