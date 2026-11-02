import type { LocalizedText, TaskKind } from '@oss/shared';
import type { DevView, GameView, KanbanColumn, TaskType } from './types';

/*
 * L'appli de tickets du bureau, « Kanbanana » : un tableau de sprint façon outil de tickets
 * professionnel (clé de ticket, type, points, avatar du dev), avec le point du Daily de chacun.
 * Elle est projetée dans la salle de réunion pendant le Daily (`render/dailyBoard.ts`) et peut
 * s'ouvrir en grand depuis le panneau de la salle (`ui/meetings/TicketApp.tsx`). Nom et logo
 * sont propres au jeu : aucune marque réelle.
 *
 * Ce module ne fait que réorganiser la `GameView` : pas de DOM, pas de Three.js.
 */

/** Nom de l'appli et clé du projet (les tickets s'appellent OSS-12, OSS-13…). */
export const TICKET_APP = { name: 'Kanbanana', project: 'OSS' } as const;

/** Colonnes du tableau, dans l'ordre (le backlog reste au planning, il n'est que compté). */
export const BOARD_COLUMNS = ['TODO', 'DOING', 'DONE'] as const satisfies readonly KanbanColumn[];
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

/** Couleurs des avatars, tirées de l'identifiant du dev (contraste AA avec du texte blanc). */
const AVATAR_COLORS = [
  '#2f6fb3',
  '#8a4fbf',
  '#b5452f',
  '#2e7d55',
  '#a34f7a',
  '#5b6b2a',
  '#9a5b12',
  '#3d5a8a',
] as const;

/** Couleur de chaque type de ticket (icône carrée, comme dans les vrais outils). */
export const TICKET_TYPE_COLORS: Record<TaskType, string> = {
  FEATURE: '#36a85b',
  BUGFIX: '#d9453a',
  REFACTOR: '#8b5cd6',
  INFRA: '#2f80d1',
};

export interface TicketPerson {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly color: string;
}

export interface TicketCard {
  readonly id: string;
  /** Clé lisible du ticket : « OSS-42 ». */
  readonly key: string;
  readonly title: LocalizedText;
  readonly type: TaskType;
  readonly size: number;
  readonly column: BoardColumn;
  readonly kind: TaskKind | null;
  readonly progress: number;
  readonly assignee: TicketPerson | null;
  /** Point du Daily sur ce ticket : avancement de la veille (null : nouveau) et du jour. */
  readonly daily: { readonly before: number | null; readonly progress: number } | null;
}

/** Une personne au Daily et ce qu'elle a dit (son ticket, ou rien en cours). */
export interface DailySpeaker extends TicketPerson {
  readonly ticket: TicketCard | null;
}

export interface TicketBoard {
  readonly sprint: number;
  readonly columns: readonly { readonly id: BoardColumn; readonly cards: readonly TicketCard[] }[];
  /** Tickets restés au backlog (pas encore planifiés). */
  readonly backlog: number;
  /** Points terminés et points engagés dans le sprint. */
  readonly donePoints: number;
  readonly totalPoints: number;
  readonly daily: {
    readonly live: boolean;
    readonly today: boolean;
    readonly useful: boolean;
    readonly focus: number;
    readonly speakers: readonly DailySpeaker[];
  } | null;
}

/** Numéro d'un ticket : celui de son entité (`e42` → `OSS-42`). */
export function ticketKey(taskId: string): string {
  return `${TICKET_APP.project}-${taskId.replace(/^\D+/, '')}`;
}

/** Initiales d'un nom (« Kevin Martin » → « KM », « Zoé » → « ZO »). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters =
    words.length === 1 ? (words[0] ?? '').slice(0, 2) : `${words[0]?.[0]}${words.at(-1)?.[0]}`;
  return letters.toUpperCase();
}

function person(dev: DevView): TicketPerson {
  let hash = 0;
  for (const char of dev.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    id: dev.id,
    name: dev.name,
    initials: initials(dev.name),
    color: AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0],
  };
}

/** Tableau de l'appli de tickets, lu dans la vue de la partie. */
export function ticketBoard(view: GameView): TicketBoard {
  const people = new Map(view.devs.map((dev) => [dev.id, person(dev)]));
  const daily = view.meetingRoom.daily;
  const points = new Map(daily?.entries.map((entry) => [entry.taskId, entry]) ?? []);
  const cards = new Map<string, TicketCard>();
  let backlog = 0;
  let donePoints = 0;
  let totalPoints = 0;
  for (const task of view.tasks) {
    if (task.column === 'BACKLOG') {
      backlog += 1;
      continue;
    }
    totalPoints += task.size;
    if (task.column === 'DONE') donePoints += task.size;
    const entry = points.get(task.id);
    cards.set(task.id, {
      id: task.id,
      key: ticketKey(task.id),
      title: task.title,
      type: task.type,
      size: task.size,
      column: task.column,
      kind: task.kind,
      progress: task.progress,
      assignee: task.assigneeId ? (people.get(task.assigneeId) ?? null) : null,
      daily: entry ? { before: entry.before, progress: entry.progress } : null,
    });
  }
  const columns = BOARD_COLUMNS.map((id) => ({
    id,
    // Les tickets dont on a parlé au Daily d'abord, puis les urgences, puis l'ordre du Kanban.
    cards: [...cards.values()]
      .filter((card) => card.column === id)
      .sort(
        (a, b) =>
          Number(b.daily !== null) - Number(a.daily !== null) ||
          Number(b.kind === 'URGENT') - Number(a.kind === 'URGENT'),
      ),
  }));
  const speakers = (daily?.attendees ?? []).flatMap((id) => {
    const who = people.get(id);
    if (!who) return [];
    const entry = daily?.entries.find((point) => point.devId === id);
    return [{ ...who, ticket: entry ? (cards.get(entry.taskId) ?? null) : null }];
  });
  return {
    sprint: view.time.sprint,
    columns,
    backlog,
    donePoints,
    totalPoints,
    daily: daily
      ? {
          live: daily.live,
          today: daily.today,
          useful: daily.useful,
          focus: daily.focus,
          speakers,
        }
      : null,
  };
}
