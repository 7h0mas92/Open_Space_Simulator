/**
 * Modèles fixes des vidéoprojecteurs et des écrans de projection déroulants : le projecteur et
 * le caisson posé au sol, instanciés comme le reste du mobilier (`office.ts`). La toile, le mât
 * et le faisceau, qui bougent, sont animés à part (`projection.ts`).
 */
import * as THREE from 'three';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

/** Dimensions d'un écran déroulant : caisson et toile, en unités de grille. */
export interface ScreenSize {
  readonly caseLength: number;
  readonly width: number;
  readonly height: number;
}

/** Les trois tailles d'écran : 2, 3 et 4 cases de large. */
export const SCREEN_SIZES: Readonly<Record<string, ScreenSize>> = {
  'projection-screen-small': { caseLength: 1.8, width: 1.6, height: 1.0 },
  'projection-screen-medium': { caseLength: 2.8, width: 2.55, height: 1.45 },
  'projection-screen-large': { caseLength: 3.8, width: 3.5, height: 1.85 },
};

/** Haut du caisson : la toile en sort par la fente. */
export const CASE_TOP = 0.13;
/** Plan de la toile (un peu en arrière du centre de la case, au-dessus de la fente). */
export const FABRIC_Z = -0.05;
/** Mât télescopique, derrière la toile. */
export const POLE_Z = -0.12;
/** Objectif du projecteur, dans le repère du modèle (l'avant est +z). */
export const LENS = [-0.065, 0.055, 0.125] as const;
/** Plafond (haut des murs) : la platine du projecteur suspendu s'y fixe. */
const CEILING = 2.2;
/** Le projecteur suspendu est retourné : son dessous est à cette hauteur. */
const HANG = 1.86;
/** Objectif du projecteur suspendu (boîtier retourné, objectif à gauche vu de face). */
export const CEILING_LENS = [0.065, HANG + 0.1 - 0.055, 0.125] as const;

/** Objectif d'un projecteur selon son modèle (posé sur un meuble ou suspendu). */
export function lensOf(kind: string): readonly [number, number, number] {
  return kind === 'ceiling-projector' ? CEILING_LENS : LENS;
}

export const ALUMINIUM = 0xc9ced6;
export const CAP = 0x2a2e38;

// --- Modèles fixes -------------------------------------------------------------------------

/** Caisson d'écran déroulant : profilé alu, embouts, pieds stabilisateurs et fente. */
function screenCase(size: ScreenSize, name: string): THREE.Group {
  const p = new Pieces([PALETTE.dark]);
  const half = size.caseLength / 2;
  // Pieds en T aux deux bouts : ils empêchent l'écran de basculer.
  for (const x of [-half + 0.12, half - 0.12]) p.box(0.07, 0.025, 0.46, CAP, [x, 0, -0.03]);
  p.soft(size.caseLength - 0.08, 0.1, 0.18, 0.03, PALETTE.dark, [0, 0.025, FABRIC_Z]);
  for (const x of [-half + 0.03, half - 0.03])
    p.soft(0.07, 0.11, 0.2, 0.02, CAP, [x, 0.02, FABRIC_Z]);
  // Fente d'où sort la toile, barre de tirage rangée dedans et logo.
  p.box(size.width + 0.02, 0.006, 0.03, 0x15171c, [0, CASE_TOP - 0.006, FABRIC_Z]);
  p.box(size.width, 0.012, 0.022, CAP, [0, CASE_TOP - 0.004, FABRIC_Z]);
  p.light(0.12, 0.02, 0.004, ALUMINIUM, [0, 0.06, FABRIC_Z + 0.09]);
  // Socle du mât télescopique.
  p.post(0.02, 0.024, 0.04, CAP, [0, CASE_TOP - 0.01, POLE_Z]);
  return p.build(name);
}

export function projectionScreenSmall(): THREE.Group {
  return screenCase(SCREEN_SIZES['projection-screen-small'] as ScreenSize, 'projectionScreenSmall');
}

export function projectionScreenMedium(): THREE.Group {
  return screenCase(
    SCREEN_SIZES['projection-screen-medium'] as ScreenSize,
    'projectionScreenMedium',
  );
}

export function projectionScreenLarge(): THREE.Group {
  return screenCase(SCREEN_SIZES['projection-screen-large'] as ScreenSize, 'projectionScreenLarge');
}

/** Vidéoprojecteur de salle de réunion : boîtier, objectif décalé, grilles, pieds, molette. */
export function videoProjector(): THREE.Group {
  const p = new Pieces([PALETTE.white]);
  for (const x of [-0.1, 0.1])
    for (const z of [-0.07, 0.07]) p.post(0.012, 0.014, 0.012, CAP, [x, 0, z], 6);
  p.soft(0.28, 0.085, 0.22, 0.02, PALETTE.white, [0, 0.01, 0]);
  // Façade sombre, bague et lentille de l'objectif.
  p.box(0.26, 0.06, 0.006, CAP, [0, 0.022, 0.11]);
  p.shape(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16).rotateX(Math.PI / 2), CAP, [
    LENS[0],
    LENS[1],
    0.115,
  ]);
  p.shape(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 16).rotateX(Math.PI / 2), 0x2f4f7a, [
    LENS[0],
    LENS[1],
    0.131,
  ]);
  // Grille d'aération à droite de l'objectif et sur le flanc.
  for (let i = 0; i < 4; i += 1)
    p.box(0.006, 0.04, 0.004, 0x15171c, [0.04 + i * 0.022, 0.03, 0.114]);
  for (let i = 0; i < 5; i += 1)
    p.box(0.004, 0.045, 0.012, 0xa9afba, [0.14, 0.028, -0.06 + i * 0.03]);
  // Molette de mise au point et voyant d'alimentation.
  p.post(0.018, 0.018, 0.008, CAP, [LENS[0], 0.095, 0.05], 10);
  p.light(0.014, 0.004, 0.014, 0x4caf6e, [0.09, 0.095, 0.06]);
  return p.build('videoProjector');
}

/**
 * Vidéoprojecteur de plafond : platine, tige télescopique et support, avec le même boîtier que le
 * projecteur de bureau monté tête en bas (comme dans les vraies salles de réunion).
 */
export function ceilingProjector(): THREE.Group {
  const body = videoProjector();
  // Retourné autour de l'axe avant-arrière : le dessus passe dessous, l'objectif reste devant.
  body.rotation.z = Math.PI;
  body.position.y = HANG + 0.1;
  const p = new Pieces();
  p.post(0.07, 0.07, 0.015, CAP, [0, CEILING - 0.015, 0], 12);
  p.post(0.016, 0.016, CEILING - 0.015 - (HANG + 0.13), ALUMINIUM, [0, HANG + 0.13, 0], 8);
  p.post(0.022, 0.022, 0.03, CAP, [0, HANG + 0.12, 0], 8);
  // Croisillon qui tient le boîtier par le dessus.
  p.box(0.2, 0.012, 0.03, CAP, [0, HANG + 0.098, 0]);
  p.box(0.03, 0.012, 0.16, CAP, [0, HANG + 0.098, 0]);
  const group = p.build('ceilingProjector');
  group.add(body);
  return group;
}
