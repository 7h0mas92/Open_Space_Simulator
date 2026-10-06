import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { KANBAN_COLUMNS, type GameView, type KanbanColumn, type TaskView } from '../../view/types';
import { useGame } from '../store/game';
import { useDragAndDrop, type DropTarget } from './useDragAndDrop';

const IMPACT_KEYS = ['users', 'hype', 'debt', 'stability', 'treasury'] as const;

/** Kanban de planification : glisser-déposer (souris et tactile) ou boutons fléchés au clavier. */
export function Kanban({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const notify = useGame((s) => s.notify);

  const move = useCallback(
    (task: TaskView, target: DropTarget) => {
      const result = dispatch({
        type: 'moveTask',
        taskId: task.id,
        column: target.column,
        index: target.index,
      });
      if (result.ok) {
        notify('kanban.moved', 'success', {
          task: t(`tasks.${task.title}` as never),
          column: t(`kanban.columns.${target.column}`),
        });
      }
    },
    [dispatch, notify, t],
  );

  const { drag, handlers } = useDragAndDrop((taskId, target) => {
    const task = view.tasks.find((candidate) => candidate.id === taskId);
    if (task) move(task, target);
  });
  const dragged = drag && view.tasks.find((task) => task.id === drag.taskId);

  return (
    <div className="kanban">
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
                        move(task, { column: target, index: Number.MAX_SAFE_INTEGER })
                      }
                      previous={KANBAN_COLUMNS[columnIndex - 1]}
                      next={KANBAN_COLUMNS[columnIndex + 1]}
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
          {t(`tasks.${dragged.title}` as never)}
        </div>
      )}
    </div>
  );
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
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const title = t(`tasks.${task.title}` as never) as string;
  return (
    <article
      className={`task-card task-${task.type.toLowerCase()} ${dragging ? 'dragging' : ''}`}
      data-task-id={task.id}
      aria-label={title}
    >
      <div
        className="task-drag"
        onPointerDown={(event) => handlers.onPointerDown(task.id, event)}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
      >
        <span className="grip" aria-hidden="true">
          ⠿
        </span>
        <div className="task-main">
          <h4>{title}</h4>
          <p className="task-meta">
            <span className="tag">{t(`taskTypes.${task.type}`)}</span>
            <span>{t('kanban.size', { size: task.size })}</span>
            <span className="impact" aria-label={t('kanban.impact')}>
              {IMPACT_KEYS.filter((key) => task.impact[key]).map((key) => (
                <span
                  key={key}
                  className={(task.impact[key] ?? 0) > 0 === (key !== 'debt') ? 'up' : 'down'}
                >
                  {t(`gauges.${key}.name`)} {(task.impact[key] ?? 0) > 0 ? '+' : ''}
                  {key === 'treasury'
                    ? `${Math.round((task.impact[key] ?? 0) / 1000)}k`
                    : task.impact[key]}
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
        {task.column !== 'BACKLOG' && task.column !== 'DONE' && (
          <label className="assignee">
            <span className="visually-hidden">{t('kanban.assignee')}</span>
            <select
              value={task.assigneeId ?? ''}
              onChange={(event) =>
                dispatch({ type: 'assignTask', taskId: task.id, devId: event.target.value || null })
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
