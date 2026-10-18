import { MEETING_FORMAT_IDS, type Phase } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { boardKey, DailyBoardView, drawTicketBoard } from '../../../src/render/dailyBoard';
import { planDecor } from '../../../src/view/decor';
import { officeLayout, roomAt } from '../../../src/view/layout';
import type { TicketBoard } from '../../../src/view/ticketBoard';

const PHASES: Phase[] = ['SEED', 'SERIES_A', 'UNICORN'];

/** Contexte 2D factice : toutes les méthodes existent et ne font rien. */
function fakeContext(): CanvasRenderingContext2D {
  const calls: string[] = [];
  return new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key === 'calls') return calls;
      if (key === 'measureText') return (text: string) => ({ width: text.length * 9 });
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        if (key === 'fillText') calls.push(String(args[0]));
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function board(live: boolean): TicketBoard {
  const card = {
    id: 'e7',
    key: 'OSS-7',
    title: { fr: 'Corriger le login', en: 'Fix login' },
    type: 'BUGFIX' as const,
    size: 3,
    column: 'DOING' as const,
    kind: null,
    progress: 0.6,
    assignee: { id: 'e1', name: 'Kevin Martin', initials: 'KM', color: '#2f6fb3' },
    daily: { before: 0.3, progress: 0.6 },
  };
  return {
    sprint: 4,
    columns: [
      { id: 'TODO', cards: [] },
      { id: 'DOING', cards: [card] },
      { id: 'DONE', cards: [] },
    ],
    backlog: 2,
    donePoints: 0,
    totalPoints: 3,
    daily: {
      live,
      today: true,
      useful: true,
      focus: 5,
      speakers: [{ ...card.assignee, ticket: card }],
    },
  };
}

describe('Daily : écran et projecteur de la salle de réunion', () => {
  it('l’écran est au milieu du mur du fond, sans objet devant', () => {
    for (const phase of PHASES) {
      const layout = officeLayout(phase);
      for (const format of MEETING_FORMAT_IDS) {
        const meeting = planDecor(layout, [], [], false, () => 0, format).meeting;
        const screen = meeting?.screen;
        expect(screen, `${phase} ${format}`).toBeTruthy();
        if (!meeting || !screen) continue;
        expect(screen.z).toBe(meeting.room.z);
        const first = screen.x - (screen.cells - 1) / 2;
        for (let dx = 0; dx < screen.cells; dx++) {
          const cell = { x: first + dx, z: screen.z };
          expect(roomAt(layout, cell)?.kind).toBe('meeting');
          expect(meeting.wall.some((prop) => prop.x === cell.x && prop.z === cell.z)).toBe(false);
        }
      }
    }
  });

  it('pendant le Daily, la toile se déroule puis l’appli s’allume ; après, tout s’éteint', () => {
    const meeting = planDecor(officeLayout('SEED'), [], [], false, () => 0, 'standup').meeting;
    const view = new DailyBoardView();
    view.setPlan(meeting);
    expect(view.root.children.length).toBeGreaterThan(0);
    view.setBoard(board(true), 'fr');
    view.update(0.016, false);
    // Sans canvas (jsdom), la toile reste blanche mais se déroule quand même.
    expect(view.root.children.some((child) => child.visible)).toBe(true);
    view.setBoard(board(false), 'fr');
    view.update(0.016, false);
    view.update(0.016, false);
    expect(view.showing).toBe(false);
    view.setPlan(null);
    expect(view.root.children).toHaveLength(0);
    view.dispose();
  });

  it('dessine le tableau, le nom de l’appli et le point du Daily', () => {
    const ctx = fakeContext();
    drawTicketBoard(ctx, board(true), 'fr', 1024, 640);
    const calls = (ctx as unknown as { calls: string[] }).calls;
    expect(calls).toContain('Kanbanana');
    expect(calls).toContain('OSS-7');
    expect(calls.some((text) => text.includes('EN COURS'))).toBe(true);
    expect(calls.some((text) => text.includes('Kevin → OSS-7'))).toBe(true);
    expect(boardKey(board(true), 'fr')).not.toBe(boardKey(board(true), 'en'));
  });
});
