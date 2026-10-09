import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { KANBAN_COLUMNS, type GameView, type KanbanColumn, type TaskView } from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { ObjectiveBanner } from './Objective';
import { PLAYER_COLUMNS, useDragAndDrop, type DropTarget } from './useDragAndDrop';

const IMPACT_KEYS = ['users', 'hype', 'debt', 'stability'] as const;

/** Le joueur range les tâches entre Backlog et À faire ; les devs font le reste. */
function isMovable(column: KanbanColumn): boolean {
  return PLAYER_COLUMNS.includes(column);
}

/** Kanban de planification : glisser-déposer (souris et tactile) ou boutons fléchés au clavier. */
export function Kanban({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const notify = useGame((s) => s.notify);

  const move = useCallback(
    async (task: TaskView, target: DropTarget) => {
      if (!isMovable(task.column) || !isMovable(target.column)) return;
      const result = await dispatch({
        type: 'moveTask',
        taskId: task.id,
        column: target.column,
        index: Math.min(target.index, 10_000),
      });
      if (result.ok) {
        notify('kanban.moved', 'success', {
          task: localized(task.title, i18n.language),
          column: t(`kanban.columns.${target.column}`),
        });
      }
    },
    [dispatch, notify, t, i18n.language],
  );

  const { drag, handlers } = useDragAndDrop((taskId, target) => {
    const task = view.tasks.find((candidate) => candidate.id === taskId);
    if (task) void move(task, target);
  });
  const dragged = drag && view.tasks.find((task) => task.id === drag.taskId);

  return (
    <div className="kanban">
      {view.objective && <ObjectiveBanner objective={view.objective} />}
      <p className="hint">{t('kanban.dragHint')}</p>
      <div className="kanban-columns">
        {KANBAN_COLUMNS.map((column, columnIndex) => {
          const tasks = view.tasks.filter((task) => task.column === column);
          const isTarget = drag?.target?.column === column;
          return (
            <section
              key={column}
              className={`kanban-column ${isTarget ? 'drop-target' : ''}`}
              data-column={column}
              aria-labelledby={`column-${column}`}
            >
              <h3 id={`column-${column}`}>
                {t(`kanban.columns.${column}`)} <span className="count">{tasks.length}</span>
              </h3>
              <ul>
                {tasks.length === 0 && <li className="empty">{t('kanban.empty')}</li>}
                {tasks.map((task, index) => (
                  <li key={task.id}>
                    {isTarget && drag?.target?.index === index && (
                      <div className="drop-indicator" />
                    )}
                    <TaskCard
                      task={task}
                      view={view}
                      dragging={drag?.taskId === task.id}
                      onMove={(target: KanbanColumn) =>
                        void move(task, { column: target, index: Number.MAX_SAFE_INTEGER })
                      }
                      previous={movableNeighbour(column, columnIndex - 1)}
                      next={movableNeighbour(column, columnIndex + 1)}
                      handlers={handlers}
                    />
                  </li>
                ))}
                {isTarget &&
                  drag?.target?.index === tasks.filter((x) => x.id !== drag.taskId).length && (
                    <li aria-hidden="true">
                      <div className="drop-indicator" />
                    </li>
                  )}
              </ul>
            </section>
          );
        })}
      </div>
      {drag && dragged && (
        <div
          className="drag-ghost"
          style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
          aria-hidden="true"
        >
          {localized(dragged.title, i18n.language)}
        </div>
      )}
    </div>
  );
}

function movableNeighbour(column: KanbanColumn, index: number): KanbanColumn | undefined {
  const neighbour = KANBAN_COLUMNS[index];
  return neighbour && isMovable(column) && isMovable(neighbour) ? neighbour : undefined;
}

interface TaskCardProps {
  task: TaskView;
  view: GameView;
  dragging: boolean;
  previous: KanbanColumn | undefined;
  next: KanbanColumn | undefined;
  onMove: (column: KanbanColumn) => void;
  handlers: ReturnType<typeof useDragAndDrop>['handlers'];
}

function TaskCard({ task, view, dragging, previous, next, onMove, handlers }: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const title = localized(task.title, i18n.language);
  const movable = isMovable(task.column);
  const days = t('time.days', { returnObjects: true }) as unknown as string[];
  return (
    <article
      className={`task-card task-${task.type.toLowerCase()} ${task.kind ? `task-${task.kind.toLowerCase()}` : ''} ${dragging ? 'dragging' : ''}`}
      data-task-id={task.id}
      aria-label={title}
    >
      <div
        className={movable ? 'task-drag' : 'task-body'}
        onPointerDown={(event) => movable && handlers.onPointerDown(task.id, event)}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
      >
        {movable && (
          <span className="grip" aria-hidden="true">
            ⠿
          </span>
        )}
        <div className="task-main">
          <h4>
            {title}
            {task.hallucinated && (
              <span className="tag tag-warning"> {t('kanban.hallucinated')}</span>
            )}
          </h4>
          {task.kind && task.column !== 'DONE' && (
            <p
              className="task-special"
              title={t(task.kind === 'URGENT' ? 'kanban.urgentHint' : 'kanban.weeklyHint')}
            >
              <span className={`tag tag-${task.kind.toLowerCase()}`}>
                {task.kind === 'URGENT' ? '🚨' : '📅'}{' '}
                {t(task.kind === 'URGENT' ? 'kanban.urgent' : 'kanban.weekly')}
              </span>
              {task.due && (
                <span className="task-due">
                  {task.hoursLeft !== null && task.hoursLeft <= 12
                    ? t('kanban.hoursLeft', { hours: Math.ceil(task.hoursLeft) })
                    : t('kanban.due', {
                        day: days[task.due.dayOfWeek - 1] ?? '',
                        hour: Math.floor(task.due.hour),
                      })}
                </span>
              )}
            </p>
          )}
          <p className="task-meta">
            <span className="tag">{t(`taskTypes.${task.type}`)}</span>
            <span>{t('kanban.size', { size: task.size })}</span>
            <span className="impact" aria-label={t('kanban.impact')}>
              {IMPACT_KEYS.filter((key) => task.impact[key]).map((key) => (
                <span
                  key={key}
                  className={(task.impact[key] ?? 0) > 0 === (key !== 'debt') ? 'up' : 'down'}
                >
                  {t(`gauges.${key}.name`)} {(task.impact[key] ?? 0) > 0 ? '▲' : '▼'}
                </span>
              ))}
            </span>
          </p>
        </div>
      </div>
      {task.column === 'DOING' && (
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={Math.round(task.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
        >
          <span style={{ width: `${task.progress * 100}%` }} />
        </div>
      )}
      <div className="task-actions">
        {task.column !== 'DONE' && (
          <label className="assignee">
            <span className="visually-hidden">{t('kanban.assignee')}</span>
            <select
              value={task.assigneeId ?? ''}
              onChange={(event) =>
                void dispatch({
                  type: 'assignTask',
                  taskId: task.id,
                  devId: event.target.value || null,
                })
              }
            >
              <option value="">{t('kanban.nobody')}</option>
              {view.devs.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name} · {t(`roles.${dev.role}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        {previous && (
          <button
            type="button"
            className="icon-button"
            aria-label={t('kanban.moveLeft', { column: t(`kanban.columns.${previous}`) })}
            onClick={() => onMove(previous)}
          >
            ←
          </button>
        )}
        {next && (
          <button
            type="button"
            className="icon-button"
            aria-label={t('kanban.moveRight', { column: t(`kanban.columns.${next}`) })}
            onClick={() => onMove(next)}
          >
            →
          </button>
        )}
      </div>
    </article>
  );
}
