/**
 * Défilement de la caméra au bord de l'écran (souris, façon jeu de stratégie), sans DOM.
 *
 * Quand le pointeur s'approche d'un bord de la scène, la vue glisse dans cette direction,
 * de plus en plus vite près du bord. S'il sort de la fenêtre par un bord, la vue continue
 * de défiler à pleine vitesse jusqu'à son retour.
 */

/** Largeur (px) de la bande sensible le long de chaque bord. */
export const EDGE_ZONE = 24;
/** Vitesse maximale du défilement, en pixels d'écran par seconde. */
export const EDGE_PAN_SPEED = 900;

export interface EdgeVelocity {
  /** -1 (bord gauche) à 1 (bord droit). */
  readonly vx: number;
  /** -1 (bord haut) à 1 (bord bas). */
  readonly vy: number;
}

/** Intensité sur un axe : 0 hors de la bande, 1 sur le bord ou au-delà. */
function axis(position: number, size: number, zone: number): number {
  if (size <= 0) return 0;
  if (position <= 0) return -1;
  if (position >= size) return 1;
  if (position < zone) return -(1 - position / zone);
  if (position > size - zone) return 1 - (size - position) / zone;
  return 0;
}

/** Vitesse de défilement pour un pointeur en (x, y), relatif au coin haut gauche de la scène. */
export function edgePanVelocity(
  x: number,
  y: number,
  width: number,
  height: number,
  zone = EDGE_ZONE,
): EdgeVelocity {
  return { vx: axis(x, width, zone), vy: axis(y, height, zone) };
}

/**
 * Position à retenir quand le pointeur quitte la fenêtre en (x, y) : on la pousse au-delà du
 * ou des bords par lesquels il est sorti, pour défiler à pleine vitesse. Un pointeur sorti
 * trop vite pour avoir touché la bande compte comme sorti par le bord le plus proche.
 */
export function exitPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  zone = EDGE_ZONE,
): { x: number; y: number } {
  const distances = { left: x, right: width - x, top: y, bottom: height - y };
  const near = (d: number) => d < zone;
  let left = near(distances.left);
  let right = near(distances.right);
  let top = near(distances.top);
  let bottom = near(distances.bottom);
  if (!left && !right && !top && !bottom) {
    const nearest = Math.min(distances.left, distances.right, distances.top, distances.bottom);
    left = distances.left === nearest;
    right = !left && distances.right === nearest;
    top = !left && !right && distances.top === nearest;
    bottom = !left && !right && !top;
  }
  return {
    x: left ? -1 : right ? width + 1 : x,
    y: top ? -1 : bottom ? height + 1 : y,
  };
}
