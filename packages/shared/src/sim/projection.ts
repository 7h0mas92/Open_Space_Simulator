import { getFurniture } from './furniture.js';

/**
 * Projecteurs et écrans de projection déroulants.
 *
 * Un projecteur est un accessoire posé sur un meuble, ou fixé au plafond au-dessus d'une case ;
 * le joueur l'allume ou l'éteint. Allumé,
 * il projette sur l'écran posé en face de lui, et cet écran se déroule. Éteint, ou sans écran
 * en face, l'écran reste enroulé dans son caisson : ni le projecteur ni l'écran ne donnent leur
 * effet. Le même calcul sert à la simulation (effets) et au rendu (écran déroulé, faisceau),
 * pour qu'ils ne se contredisent jamais. Aucun tirage aléatoire.
 */

/** Distance maximale entre un projecteur et son écran, en cases. */
export const PROJECTION_RANGE = 10;
/** Distance minimale : collé à l'écran, l'image ne fait que quelques centimètres. */
export const PROJECTION_MIN_DISTANCE = 1.5;
/**
 * Cosinus de l'angle maximal entre l'axe du projecteur et la direction de l'écran (50°) : il
 * faut le tourner à peu près vers l'écran.
 */
const AIM_COSINE = Math.cos((50 * Math.PI) / 180);
/** Le projecteur doit se trouver devant la toile, pas derrière son caisson. */
const FRONT_COSINE = 0.2;

/** Un objet posé, tel que le voient la simulation et le rendu. */
export interface ProjectionItem {
  readonly id: string;
  readonly itemId: string;
  readonly x: number;
  /** Rangée de la grille (`y` dans la simulation, `z` dans le rendu). */
  readonly y: number;
  readonly rotation: number;
  /** Accessoire : le meuble qui le porte. */
  readonly hostId?: string;
  /** Projecteur allumé. */
  readonly on?: boolean;
}

/** Un projecteur allumé et l'écran sur lequel il projette. */
export interface ProjectionPair {
  readonly projector: string;
  readonly screen: string;
  /** Distance entre les deux, en cases. */
  readonly distance: number;
}

export function isProjector(itemId: string): boolean {
  return getFurniture(itemId)?.projector === true;
}

export function isProjectionScreen(itemId: string): boolean {
  return getFurniture(itemId)?.projectionScreen === true;
}

/**
 * Direction vers laquelle regarde un objet tourné de `rotation` quarts de tour : l'avant d'un
 * modèle est +y (+z dans le rendu), et un quart de tour l'amène vers +x.
 */
export function facing(rotation: number): readonly [number, number] {
  const turn = ((rotation % 4) + 4) % 4;
  return (
    [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const
  )[turn] as readonly [number, number];
}

/** Centre de l'emprise d'un objet posé au sol. */
function center(item: ProjectionItem): readonly [number, number] {
  const def = getFurniture(item.itemId);
  const turned = item.rotation % 2 === 1;
  const width = def ? (turned ? def.depth : def.width) : 1;
  const depth = def ? (turned ? def.width : def.depth) : 1;
  return [item.x + (width - 1) / 2, item.y + (depth - 1) / 2];
}

/**
 * Associe chaque projecteur allumé à l'écran le plus proche posé en face de lui (un écran par
 * projecteur). Les projecteurs sont servis dans l'ordre de la liste, donc d'achat.
 */
export function projectionPairs(items: readonly ProjectionItem[]): ProjectionPair[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const screens = items.filter((item) => !item.hostId && isProjectionScreen(item.itemId));
  const taken = new Set<string>();
  const pairs: ProjectionPair[] = [];
  for (const projector of items) {
    if (!projector.on || !isProjector(projector.itemId)) continue;
    // Un projecteur de plafond vise depuis sa propre case ; un projecteur posé, depuis son meuble.
    const host = projector.hostId ? byId.get(projector.hostId) : undefined;
    // Un projecteur sans meuble (sauvegarde abîmée) ne projette pas.
    if (projector.hostId && !host) continue;
    const [px, py] = center(host ?? projector);
    // L'accessoire tourne avec son meuble, puis de sa propre rotation.
    const [ax, ay] = facing((host?.rotation ?? 0) + projector.rotation);
    let best: ProjectionPair | null = null;
    for (const screen of screens) {
      if (taken.has(screen.id)) continue;
      const [sx, sy] = center(screen);
      const dx = sx - px;
      const dy = sy - py;
      const distance = Math.hypot(dx, dy);
      if (distance < PROJECTION_MIN_DISTANCE || distance > PROJECTION_RANGE) continue;
      if ((dx * ax + dy * ay) / distance < AIM_COSINE) continue;
      const [fx, fy] = facing(screen.rotation);
      if ((-dx * fx - dy * fy) / distance < FRONT_COSINE) continue;
      if (!best || distance < best.distance)
        best = { projector: projector.id, screen: screen.id, distance };
    }
    if (best) {
      taken.add(best.screen);
      pairs.push(best);
    }
  }
  return pairs;
}
