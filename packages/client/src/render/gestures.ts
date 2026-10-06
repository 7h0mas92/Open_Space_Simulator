/**
 * Reconnaissance des gestes souris et tactiles, indépendante du DOM (testable) :
 * - glisser (souris ou un doigt) pour déplacer la caméra ;
 * - pincer (deux doigts) pour zoomer ;
 * - appui court = sélection (tap/clic) ; appui long = sélection sur mobile.
 */
export interface PointerSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Horodatage en millisecondes. */
  readonly time: number;
  readonly touch: boolean;
}

export type GestureEvent =
  | { readonly type: 'pan'; readonly dx: number; readonly dy: number }
  | { readonly type: 'pinch'; readonly scale: number; readonly x: number; readonly y: number }
  | { readonly type: 'tap'; readonly x: number; readonly y: number }
  | { readonly type: 'longPress'; readonly x: number; readonly y: number }
  | { readonly type: 'hover'; readonly x: number; readonly y: number }
  /** Fin d'un glisser-déposer quand le déplacement de caméra est verrouillé (construction). */
  | { readonly type: 'drop'; readonly x: number; readonly y: number };

/** Distance (px) au-delà de laquelle un appui devient un glissement. */
export const DRAG_THRESHOLD = 8;
/** Durée (ms) d'un appui long. */
export const LONG_PRESS_MS = 450;

interface Active {
  startX: number;
  startY: number;
  x: number;
  y: number;
  startTime: number;
  touch: boolean;
}

export class GestureRecognizer {
  private readonly pointers = new Map<number, Active>();
  private dragging = false;
  private pinchDistance = 0;
  private longPressFired = false;
  private wasPinching = false;
  /** Quand vrai, le glissement d'un doigt/clic est réservé (mode construction). */
  panLocked = false;

  down(sample: PointerSample): GestureEvent[] {
    this.pointers.set(sample.id, {
      startX: sample.x,
      startY: sample.y,
      x: sample.x,
      y: sample.y,
      startTime: sample.time,
      touch: sample.touch,
    });
    this.longPressFired = false;
    if (this.pointers.size === 2) {
      this.pinchDistance = this.distance();
      this.dragging = true; // un pincement n'est jamais un tap
      this.wasPinching = true;
    }
    return [];
  }

  move(sample: PointerSample): GestureEvent[] {
    const pointer = this.pointers.get(sample.id);
    if (!pointer) return [{ type: 'hover', x: sample.x, y: sample.y }];
    const dx = sample.x - pointer.x;
    const dy = sample.y - pointer.y;
    pointer.x = sample.x;
    pointer.y = sample.y;

    if (this.pointers.size >= 2) {
      const distance = this.distance();
      const events: GestureEvent[] = [];
      if (this.pinchDistance > 0 && distance > 0) {
        const center = this.center();
        events.push({
          type: 'pinch',
          scale: distance / this.pinchDistance,
          x: center.x,
          y: center.y,
        });
      }
      this.pinchDistance = distance;
      // Les deux doigts qui glissent ensemble déplacent aussi la vue (moitié du déplacement).
      events.push({ type: 'pan', dx: dx / 2, dy: dy / 2 });
      return events;
    }

    const moved = Math.hypot(sample.x - pointer.startX, sample.y - pointer.startY);
    if (!this.dragging && moved > DRAG_THRESHOLD) this.dragging = true;
    if (this.dragging && !this.panLocked) return [{ type: 'pan', dx, dy }];
    return [{ type: 'hover', x: sample.x, y: sample.y }];
  }

  /** À appeler régulièrement (chaque frame) pour détecter l'appui long. */
  poll(time: number): GestureEvent[] {
    if (this.pointers.size !== 1 || this.dragging || this.longPressFired) return [];
    const [pointer] = this.pointers.values();
    if (!pointer || !pointer.touch || time - pointer.startTime < LONG_PRESS_MS) return [];
    this.longPressFired = true;
    return [{ type: 'longPress', x: pointer.x, y: pointer.y }];
  }

  up(sample: PointerSample): GestureEvent[] {
    const pointer = this.pointers.get(sample.id);
    this.pointers.delete(sample.id);
    if (!pointer) return [];
    const events: GestureEvent[] = [];
    if (this.pointers.size === 0) {
      if (!this.dragging && !this.longPressFired)
        events.push({ type: 'tap', x: sample.x, y: sample.y });
      else if (this.dragging && this.panLocked && !this.wasPinching) {
        events.push({ type: 'drop', x: sample.x, y: sample.y });
      }
      this.dragging = false;
      this.wasPinching = false;
    } else if (this.pointers.size === 1) {
      // On relâche un doigt d'un pincement : le doigt restant ne doit pas produire de tap.
      this.pinchDistance = 0;
    }
    return events;
  }

  cancel(id: number): void {
    this.pointers.delete(id);
    if (this.pointers.size === 0) this.dragging = false;
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private center(): { x: number; y: number } {
    const [a, b] = [...this.pointers.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
  }
}
