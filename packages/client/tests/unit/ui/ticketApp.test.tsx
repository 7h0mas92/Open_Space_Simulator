import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '../../../src/i18n';
import { holdTeamMeeting } from '../../../src/simulation/meetings';
import { TicketApp } from '../../../src/ui/meetings/TicketApp';
import { makeContext } from '../../simulation/fixtures';
import { officeSimulation, SEED_OFFICE, viewOf } from '../fixtures/game';

describe('Kanbanana, l’appli de tickets', () => {
  it('montre le tableau du sprint et le point de chacun au Daily', async () => {
    await i18n.changeLanguage('fr');
    const simulation = officeSimulation(SEED_OFFICE);
    const { state } = simulation;
    state.stage = 'EXECUTION';
    state.meetingRoom = { format: 'standup', paid: 0, fittedAtSprint: 1 };
    const devs = Object.keys(state.components.identity);
    const task = Object.keys(state.components.task)[0] ?? '';
    const dev = devs[0] ?? '';
    const worker = state.components.worker[dev];
    const ticket = state.components.task[task];
    if (worker && ticket) {
      worker.taskId = task;
      ticket.assigneeId = dev;
      ticket.column = 'IN_PROGRESS';
    }
    holdTeamMeeting(state, makeContext(state), devs);
    render(<TicketApp view={viewOf(simulation)} />);
    const app = screen.getByTestId('ticket-app');
    expect(within(app).getByText('Kanbanana')).toBeTruthy();
    expect(within(app).getByRole('region', { name: 'En cours' })).toBeTruthy();
    expect(within(app).getAllByText(`OSS-${task.slice(1)}`).length).toBeGreaterThanOrEqual(2);
    expect(within(app).getByText('Daily de ce matin')).toBeTruthy();
  });

  it('sans Daily, explique comment en avoir un', async () => {
    await i18n.changeLanguage('en');
    render(<TicketApp view={viewOf(officeSimulation(SEED_OFFICE))} />);
    expect(screen.getByText(/No Daily yet/)).toBeTruthy();
    await i18n.changeLanguage('fr');
  });
});
