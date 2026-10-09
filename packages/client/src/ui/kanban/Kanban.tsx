import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaskTrade } from '@oss/shared';
import {
  KANBAN_COLUMNS,
  type DevView,
  type GameView,
  type KanbanColumn,
  type TaskView,
} from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { ObjectiveBanner } from './Objective';
import { PLAYER_COLUMNS, useDragAndDrop, type DropTarget } from './useDragAndDrop';

const IMPACT_KEYS = ['users', 'hype', 'debt', 'stability'] as const;

/** Pictogramme de chaque métier, à côté de son nom sur les cartes. */
const TRADE_ICONS: Record<TaskTrade, string> = {
  DEV: '💻',
  DESIGN: '🎨',
  PRODUCT: '📋',
  QA: '🔍',
};

/** Un dev front devant une tâche back (ou l'inverse) : proposé après les autres. */
function offSide(dev: DevView, task: TaskView): boolean {
  return (
    dev.stack !== null && dev.stack !== 'FULL' && task.stack !== null && dev.stack !== task.stack
  );
}

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

  const backlogCount = view.tasks.filter((task) => task.column === 'BACKLOG').length;
  const moveAll = useCallback(async () => {
    const result = await dispatch({ type: 'moveAllToTodo' });
    if (result.ok) notify('kanban.movedAll', 'success', { count: backlogCount });
  }, [dispatch, notify, backlogCount]);

  const { drag, handlers } = useDragAndDrop((taskId, target) => {
    const task = view.tasks.find((candidate) => candidate.id === taskId);
    if (task) void move(task, target);
  });
  const dragged = drag && view.tasks.find((task) => task.id === drag.taskId);

  return (
    <div className="kanban">
      {view.objective && <ObjectiveBanner objective={view.objective} />}
      <div className="kanban-toolbar">
        <p className="hint">{t('kanban.dragHint')}</p>
        {backlogCount > 0 && (
          <button type="button" className="kanban-move-all" onClick={() => void moveAll()}>
            {t('kanban.moveAll', { count: backlogCount })}
          </button>
        )}
      </div>
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
  const sameTrade = view.devs
    .filter((dev) => dev.trade === task.trade)
    .sort((a, b) => Number(offSide(a, task)) - Number(offSide(b, task)));
  const otherTrades = view.devs.filter((dev) => dev.trade !== task.trade);
  const devOption = (dev: DevView) => (
    <option key={dev.id} value={dev.id}>
      {dev.name} · {t(`roles.${dev.role}`)}
    </option>
  );
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
            <span className={`tag tag-trade trade-${task.trade.toLowerCase()}`}>
              <span aria-hidden="true">{TRADE_ICONS[task.trade]}</span> {t(`trades.${task.trade}`)}
              {task.stack && <> · {t(`stacks.${task.stack}`)}</>}
            </span>
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
          {task.column !== 'DONE' && sameTrade.length === 0 && (
            <p className="task-note">{t('kanban.noTrade')}</p>
          )}
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
              {sameTrade.map(devOption)}
              {otherTrades.length > 0 && (
                <optgroup label={t('kanban.otherTrades')}>{otherTrades.map(devOption)}</optgroup>
              )}
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
