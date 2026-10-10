/**
 * Écrans des postes de travail, en formes Three.js (asset manquant `deskMonitors`).
 *
 * L'écran ne fait plus partie du bureau : la simulation garde, pour chaque bureau de dev et
 * bureau debout, un modèle (bureautique, pivoté vertical, gaming, pro ultra-fin, incurvé), une
 * taille et une fixation (pied ou bras articulé). Ce fichier en tire :
 * - la géométrie de l'écran, posée sur le plateau du bureau (`buildMonitor`) ;
 * - la position de sa dalle, où `screens.ts` affiche le contenu animé quand le dev travaille
 *   (`monitorScreenMount`).
 *
 * Repère d'un écran : l'origine est sur le plateau, au pied de l'écran ; la dalle regarde +z.
 * Sur un bras, l'écran flotte plus haut et plus au fond, et le pied laisse la place libre.
 */
import {
  DEFAULT_MONITOR,
  type MonitorChoice,
  type MonitorModel,
  type MonitorSize,
} from '@oss/shared';
import * as THREE from 'three';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

/** Où se pose l'écran sur chaque poste de travail (repère du meuble, centre de l'emprise). */
interface MonitorAnchor {
  /** Position préférée du pied [x, hauteur du plateau, z]. */
  readonly at: readonly [number, number, number];
  /** Bord arrière du plateau, en z relatif au pied (là où se pince le bras). */
  readonly back: number;
  /** Demi-largeur du plateau : un grand écran se décale pour ne pas déborder. */
  readonly halfWidth: number;
}

export const MONITOR_ANCHORS: Readonly<Record<string, MonitorAnchor>> = {
  // Bureau de dev : l'écran au-dessus du clavier, à gauche du plateau.
  desk: { at: [-0.35, 0.77, -0.15], back: -0.24, halfWidth: 0.73 },
  // Bureau debout : l'écran au milieu.
  'standing-desk': { at: [0, 1.1, -0.2], back: -0.175, halfWidth: 0.95 },
};

/** Le poste porte-t-il un écran à choisir ? */
export function hasMonitor(kind: string): boolean {
  return kind in MONITOR_ANCHORS;
}

/** Écran d'un objet posé : celui choisi, celui livré pour un poste de travail, sinon `null`. */
export function monitorOfItem(item: {
  readonly kind: string;
  readonly monitor?: MonitorChoice;
}): MonitorChoice | null {
  if (!hasMonitor(item.kind)) return null;
  return item.monitor ?? DEFAULT_MONITOR;
}

/** Allure d'un modèle : taille de la dalle et de ses bords, couleurs. */
interface MonitorStyle {
  /** Largeur de la zone affichée pour chaque taille ; la hauteur suit `ratio`. */
  readonly widths: readonly [number, number, number];
  /** Hauteur / largeur de la zone affichée. */
  readonly ratio: number;
  /** Bords autour de la dalle : côtés et haut, menton. */
  readonly bezel: number;
  readonly chin: number;
  /** Épaisseur du boîtier. */
  readonly depth: number;
  /** Hauteur du bas de l'écran au-dessus du plateau, sur son pied. */
  readonly lift: number;
  readonly body: number;
  readonly stand: number;
  /** Rayon de courbure (écran incurvé), sinon absent. */
  readonly curve?: number;
}

const STYLES: Record<MonitorModel, MonitorStyle> = {
  office: {
    widths: [0.54, 0.62, 0.72],
    ratio: 9 / 16,
    bezel: 0.02,
    chin: 0.04,
    depth: 0.045,
    lift: 0.13,
    body: 0x2b2f3b,
    stand: 0x2b2f3b,
  },
  portrait: {
    widths: [0.3, 0.34, 0.4],
    ratio: 16 / 9,
    bezel: 0.014,
    chin: 0.022,
    depth: 0.04,
    lift: 0.1,
    body: 0x3a3f4d,
    stand: 0x23262f,
  },
  gaming: {
    widths: [0.54, 0.62, 0.72],
    ratio: 9 / 16,
    bezel: 0.012,
    chin: 0.03,
    depth: 0.05,
    lift: 0.15,
    body: 0x1b1d24,
    stand: 0x1b1d24,
  },
  slim: {
    widths: [0.55, 0.63, 0.73],
    ratio: 9 / 16,
    bezel: 0.006,
    chin: 0.012,
    depth: 0.016,
    lift: 0.13,
    body: 0xe4e6ea,
    stand: 0xc9ced6,
  },
  curved: {
    widths: [0.76, 0.84, 0.92],
    ratio: 0.43,
    bezel: 0.01,
    chin: 0.022,
    depth: 0.04,
    lift: 0.12,
    body: 0x262a33,
    stand: 0xb9bfc9,
    curve: 1.6,
  },
};

/** Dalle éteinte : verre sombre. */
const GLASS = 0x121827;
/** Liseré lumineux des écrans gaming. */
const GAMING_LED = 0xff3b5c;
/** Hauteur du bas de l'écran sur un bras articulé. */
const ARM_LIFT = 0.21;
/** Distance du bord arrière du plateau à la face avant de la dalle, sur un bras. */
const ARM_REACH = 0.21;

const SIZE_INDEX: Record<MonitorSize, 0 | 1 | 2> = { small: 0, medium: 1, large: 2 };

/** Mesures d'un écran posé sur un poste, dans le repère du meuble. */
export interface MonitorLayout {
  /** Où poser l'origine de l'écran (son pied) sur le plateau. */
  readonly origin: readonly [number, number, number];
  /** Zone affichée. */
  readonly width: number;
  readonly height: number;
  /** Boîtier complet, bords compris. */
  readonly outerWidth: number;
  readonly outerHeight: number;
  /** Bas du boîtier, au-dessus du plateau. */
  readonly bottom: number;
  /** Face avant de la dalle (au centre), en z relatif à l'origine. */
  readonly front: number;
  /** Rayon de courbure, ou `null` pour un écran plat. */
  readonly curve: number | null;
}

export function monitorLayout(kind: string, choice: MonitorChoice): MonitorLayout | null {
  const anchor = MONITOR_ANCHORS[kind];
  if (!anchor) return null;
  const style = STYLES[choice.model];
  const width = style.widths[SIZE_INDEX[choice.size]];
  const height = width * style.ratio;
  const outerWidth = width + style.bezel * 2;
  const outerHeight = height + style.bezel + style.chin;
  // Un écran large se décale vers le milieu du plateau pour ne pas déborder.
  const limit = anchor.halfWidth - outerWidth / 2 - 0.02;
  const x = Math.min(Math.max(anchor.at[0], -limit), limit);
  const arm = choice.mount === 'arm';
  return {
    origin: [x, anchor.at[1], anchor.at[2]],
    width,
    height,
    outerWidth,
    outerHeight,
    bottom: arm ? ARM_LIFT : style.lift,
    front: arm ? anchor.back + ARM_REACH : style.depth,
    curve: style.curve ?? null,
  };
}

/** Clé du gabarit d'un écran, pour regrouper les instances identiques. */
export function monitorKey(kind: string, choice: MonitorChoice): string {
  return `@monitor:${kind}:${choice.model}:${choice.size}:${choice.mount}`;
}

/** Relit une clé de `monitorKey`, ou `null` si ce n'en est pas une. */
export function parseMonitorKey(key: string): { kind: string; choice: MonitorChoice } | null {
  const [tag, kind, model, size, mount] = key.split(':');
  if (tag !== '@monitor' || !kind || !model || !size || !mount) return null;
  return {
    kind,
    choice: {
      model: model as MonitorModel,
      size: size as MonitorSize,
      mount: mount === 'arm' ? 'arm' : 'stand',
    },
  };
}

/** Boîtier et dalle : plats, ou en arc de cercle pour l'écran incurvé. */
function panel(p: Pieces, style: MonitorStyle, layout: MonitorLayout): void {
  const { width, height, outerWidth, outerHeight, bottom, front } = layout;
  const back = front - style.depth;
  const glassY = bottom + style.chin;
  if (layout.curve === null) {
    p.soft(outerWidth, outerHeight, style.depth, 0.008, style.body, [
      0,
      bottom,
      back + style.depth / 2,
    ]);
    p.box(width, height, 0.004, GLASS, [0, glassY, front]);
    return;
  }
  // Écran incurvé : des tranches tournées le long d'un arc, bords vers l'avant.
  const radius = layout.curve;
  const arc = (span: number, depth: number, color: number, y: number, h: number, z: number) => {
    const slices = 14;
    const step = span / radius / slices;
    for (let i = 0; i < slices; i += 1) {
      const a = -span / radius / 2 + step * (i + 0.5);
      const dz = radius - Math.cos(a) * radius;
      p.box(step * radius + 0.003, h, depth, color, [Math.sin(a) * radius, y, z + dz], { y: -a });
    }
  };
  arc(outerWidth, style.depth, style.body, bottom, outerHeight, back + style.depth / 2);
  arc(width, 0.004, GLASS, glassY, height, front);
}

/** Pied propre à chaque modèle, posé sur le plateau. */
function stand(p: Pieces, model: MonitorModel, style: MonitorStyle, layout: MonitorLayout): void {
  const back = layout.front - style.depth;
  const neckTop = layout.bottom + layout.outerHeight * 0.45;
  const neckZ = back - 0.02;
  switch (model) {
    case 'office':
      // Socle carré, colonne droite.
      p.soft(0.26, 0.016, 0.18, 0.006, style.stand, [0, 0, neckZ + 0.03]);
      p.box(0.06, neckTop, 0.03, style.stand, [0, 0.01, neckZ]);
      break;
    case 'portrait':
      // Socle rond, colonne et rotule de pivot bien visible.
      p.post(0.13, 0.14, 0.016, style.stand, [0, 0, neckZ + 0.02], 20);
      p.post(0.022, 0.022, neckTop, style.stand, [0, 0.016, neckZ], 10);
      p.shape(
        new THREE.CylinderGeometry(0.05, 0.05, 0.02, 18).rotateX(Math.PI / 2),
        PALETTE.metal,
        [0, layout.bottom + layout.outerHeight / 2, back - 0.01],
      );
      break;
    case 'gaming': {
      // Pied en V, colonne anguleuse et liseré rouge sous l'écran et dans le dos.
      for (const side of [-1, 1])
        p.box(0.045, 0.014, 0.26, style.stand, [side * 0.11, 0, neckZ + 0.06], { y: side * 0.5 });
      p.box(0.07, neckTop, 0.04, style.stand, [0, 0.01, neckZ - 0.01], { x: -0.08 });
      p.light(0.04, 0.012, 0.004, GAMING_LED, [0, neckTop * 0.5, neckZ + 0.012]);
      break;
    }
    case 'slim':
      // Pied en aluminium : une plaque fine posée derrière l'écran, penchée vers son dos.
      p.box(0.2, 0.008, 0.17, style.stand, [0, 0, neckZ - 0.02]);
      p.box(0.15, neckTop + 0.04, 0.012, style.stand, [0, 0, neckZ - 0.04], { x: 0.2 });
      break;
    case 'curved':
      // Socle en croissant chromé, large pour tenir un grand écran.
      p.shape(
        new THREE.TorusGeometry(0.17, 0.018, 6, 20, Math.PI).rotateX(Math.PI / 2),
        style.stand,
        [0, 0.012, neckZ + 0.02],
      );
      p.box(0.07, neckTop, 0.035, style.stand, [0, 0.01, neckZ]);
      break;
  }
}

/**
 * Bras articulé : pince au bord arrière du plateau, colonne, deux segments qui ramènent
 * l'écran vers l'avant, plaque de fixation dans son dos.
 */
function arm(p: Pieces, style: MonitorStyle, layout: MonitorLayout, deskBack: number): void {
  const steel = 0x2f3340;
  const clampZ = deskBack + 0.03;
  const centerY = layout.bottom + layout.outerHeight / 2;
  const plateZ = layout.front - style.depth - 0.012;
  const poleX = layout.curve === null ? -0.05 : 0;
  // Pince en C sous et sur le plateau, molette de serrage.
  p.box(0.08, 0.03, 0.08, steel, [poleX, 0, clampZ]);
  p.box(0.08, 0.06, 0.02, steel, [poleX, -0.06, clampZ - 0.035]);
  p.box(0.08, 0.012, 0.08, steel, [poleX, -0.072, clampZ]);
  p.post(0.012, 0.012, 0.06, PALETTE.chrome, [poleX, -0.13, clampZ], 8);
  // Colonne, puis coude et deux segments à gaz.
  const poleTop = centerY + 0.02;
  p.post(0.017, 0.017, poleTop - 0.03, PALETTE.chrome, [poleX, 0.03, clampZ], 10);
  const elbow: [number, number, number] = [poleX + 0.16, centerY - 0.02, (clampZ + plateZ) / 2];
  p.bar([poleX, poleTop - 0.02, clampZ], elbow, 0.016, steel, 8);
  p.post(0.022, 0.022, 0.03, steel, [elbow[0], elbow[1] - 0.015, elbow[2]], 10);
  p.bar(elbow, [0, centerY, plateZ], 0.016, steel, 8);
  // Plaque de fixation et rotule au dos de l'écran.
  p.box(0.1, 0.1, 0.012, steel, [0, centerY - 0.05, plateZ + 0.006]);
  p.post(0.02, 0.02, 0.03, PALETTE.chrome, [0, centerY - 0.015, plateZ - 0.005], 8);
}

/** Petits détails du boîtier : voyant, liseré gaming, logo neutre. */
function trim(p: Pieces, model: MonitorModel, style: MonitorStyle, layout: MonitorLayout): void {
  const { bottom, front, outerWidth } = layout;
  const halfW = layout.curve === null ? outerWidth / 2 : layout.width / 2;
  // Voyant d'alimentation dans le menton (coin droit).
  const ledX = Math.min(halfW - 0.04, 0.28);
  const ledZ =
    front +
    (layout.curve === null ? 0 : layout.curve - Math.cos(ledX / layout.curve) * layout.curve);
  p.light(0.012, 0.006, 0.004, model === 'gaming' ? GAMING_LED : 0x7cc8f4, [
    ledX,
    bottom + style.chin * 0.35,
    ledZ + 0.001,
  ]);
  if (model === 'gaming') {
    // Liseré lumineux le long du menton et bandeau en V au dos.
    p.light(Math.min(0.3, halfW), 0.006, 0.004, GAMING_LED, [0, bottom + 0.003, front + 0.001]);
    const back = front - style.depth;
    p.light(0.18, 0.012, 0.004, GAMING_LED, [0, bottom + layout.outerHeight * 0.6, back - 0.004]);
  }
  if (model === 'slim') {
    // Dos bombé fin sous la dalle.
    const back = front - style.depth;
    p.soft(outerWidth * 0.5, layout.outerHeight * 0.4, 0.02, 0.008, style.body, [
      0,
      bottom + layout.outerHeight * 0.25,
      back - 0.01,
    ]);
  }
}

/**
 * Écran complet dans son repère (origine au pied, sur le plateau). Pour un écran sur bras,
 * `kind` donne le bord arrière du plateau où se pince le bras.
 */
export function buildMonitor(kind: string, choice: MonitorChoice): THREE.Group {
  const layout = monitorLayout(kind, choice);
  const anchor = MONITOR_ANCHORS[kind];
  const p = new Pieces();
  if (!layout || !anchor) return p.build('monitor');
  const style = STYLES[choice.model];
  panel(p, style, layout);
  if (choice.mount === 'arm') arm(p, style, layout, anchor.back);
  else stand(p, choice.model, style, layout);
  trim(p, choice.model, style, layout);
  return p.build(`monitor-${choice.model}-${choice.size}-${choice.mount}`);
}

/** Dalle d'un écran, dans le repère du meuble : où `screens.ts` dessine le contenu. */
export interface MonitorScreen {
  readonly at: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /** Écran incurvé : avancée des bords (le contenu se courbe avec la dalle), sinon absent. */
  readonly bend?: number;
}

export function monitorScreen(kind: string, choice: MonitorChoice): MonitorScreen | null {
  const layout = monitorLayout(kind, choice);
  if (!layout) return null;
  const style = STYLES[choice.model];
  const [x, y, z] = layout.origin;
  const screen = {
    at: [x, y + layout.bottom + style.chin + layout.height / 2, z + layout.front + 0.004] as const,
    width: layout.width - 0.004,
    height: layout.height - 0.004,
  };
  // Avancée des bords d'un arc de rayon r et de largeur w : (w/2)² / 2r, soit w² / 8r.
  return layout.curve === null
    ? screen
    : { ...screen, bend: (layout.width * layout.width) / (8 * layout.curve) };
}
