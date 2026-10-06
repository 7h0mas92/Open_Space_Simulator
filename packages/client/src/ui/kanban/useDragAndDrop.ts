import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { KanbanColumn } from '../../view/types';

/** Colonnes où le joueur peut déposer une carte (les devs gèrent « En cours » et « Terminé »). */
export const PLAYER_COLUMNS: readonly KanbanColumn[] = ['BACKLOG', 'TODO'];

export interface DropTarget {
  readonly column: KanbanColumn;
  readonly index: number;
}

export interface DragState {
  readonly taskId: string;
  readonly x: number;
  readonly y: number;
  readonly target: DropTarget | null;
}

/** Distance (px) avant qu'un appui devienne un glisser. */
const DRAG_START = 6;

/**
 * Cherche la colonne et la position d'insertion sous le pointeur, à partir des attributs
 * `data-column` (colonnes) et `data-task-id` (cartes) du DOM.
 */
export function dropTargetAt(x: number, y: number, draggedId: string): DropTarget | null {
  const elements =
    typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
  const columnElement = elements.find((el) => el instanceof HTMLElement && el.dataset.column) as
    HTMLElement | undefined;
  const column = columnElement?.dataset.column as KanbanColumn | undefined;
  if (!columnElement || !column || !PLAYER_COLUMNS.includes(column)) return null;
  const cards = [...columnElement.querySelectorAll<HTMLElement>('[data-task-id]')].filter(
    (card) => card.dataset.taskId !== draggedId,
  );
  let index = cards.length;
  const below = cards.findIndex((card) => {
    const rect = card.getBoundingClientRect();
    return y < rect.top + rect.height / 2;
  });
  if (below !== -1) index = below;
  return { column, index };
}

/**
 * Glisser-déposer au pointeur : fonctionne à la souris, au stylet et au doigt (Pointer Events).
 * La poignée de la carte a `touch-action: none` pour que le glisser ne fasse pas défiler la page.
 */
export function useDragAndDrop(onDrop: (taskId: string, target: DropTarget) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const start = useRef<{ taskId: string; x: number; y: number; active: boolean } | null>(null);

  const onPointerDown = useCallback((taskId: string, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    start.current = { taskId, x: event.clientX, y: event.clientY, active: false };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const origin = start.current;
    if (!origin) return;
    if (
      !origin.active &&
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < DRAG_START
    )
      return;
    origin.active = true;
    setDrag({
      taskId: origin.taskId,
      x: event.clientX,
      y: event.clientY,
      target: dropTargetAt(event.clientX, event.clientY, origin.taskId),
    });
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const origin = start.current;
      start.current = null;
      setDrag(null);
      if (!origin?.active) return;
      const target = dropTargetAt(event.clientX, event.clientY, origin.taskId);
      if (target) onDrop(origin.taskId, target);
    },
    [onDrop],
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
    setDrag(null);
  }, []);

  return { drag, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
