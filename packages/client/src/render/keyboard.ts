/**
 * Clavier QWERTY du bureau de dev, en formes Three.js : boîtier sombre et vraies touches en
 * relief, avec leurs lettres. Le clavier du kit Kenney n'est qu'un pavé lisse.
 *
 * Toutes les touches tiennent en une seule géométrie et un seul matériau (un appel de dessin) :
 * leur texture est une vue de dessus du clavier, dessinée pixel par pixel avec une police
 * maison de 3 x 5 (aucune police à charger, rendu identique partout, testable dans Vitest).
 * Le dessus de chaque touche lit sa case dans cette texture, ses flancs une bande unie.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PixelCanvas } from './pixels';

/** Une touche : son libellé (vide pour les touches de fonction) et sa largeur en unités. */
export interface KeySpec {
  readonly label: string;
  readonly width: number;
  /** Touches de fonction (Tab, Maj, Ctrl…) : plus foncées. Entrée : couleur d'accent. */
  readonly kind?: 'mod' | 'accent';
}

const key = (label: string, width = 1, kind?: KeySpec['kind']): KeySpec =>
  kind ? { label, width, kind } : { label, width };
const letters = (row: string): KeySpec[] => [...row].map((label) => key(label));
const mod = (width: number): KeySpec => key('', width, 'mod');

/** Disposition QWERTY américaine, 15 unités par rangée, de la rangée des chiffres à l'espace. */
export const QWERTY_ROWS: readonly (readonly KeySpec[])[] = [
  [...letters('`1234567890-='), mod(2)],
  [mod(1.5), ...letters('QWERTYUIOP[]'), key('\\', 1.5)],
  [mod(1.75), ...letters("ASDFGHJKL;'"), key('', 2.25, 'accent')],
  [mod(2.25), ...letters('ZXCVBNM,./'), mod(2.75)],
  [mod(1.25), mod(1.25), mod(1.25), key('', 6.25), mod(1.25), mod(1.25), mod(1.25), mod(1.25)],
];

/** Police 3 x 5 : une chaîne par ligne, « # » pour un pixel allumé. */
const GLYPHS: Record<string, readonly string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '`': ['#..', '.#.', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '=': ['...', '###', '...', '###', '...'],
  '[': ['##.', '#..', '#..', '#..', '##.'],
  ']': ['.##', '..#', '..#', '..#', '.##'],
  '\\': ['#..', '#..', '.#.', '..#', '..#'],
  ';': ['...', '.#.', '...', '.#.', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  ',': ['...', '...', '...', '.#.', '#..'],
  '.': ['...', '...', '...', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
};

export const KEYBOARD_COLORS = {
  case: 0x343a4f,
  key: 0xe9ebf0,
  mod: 0xb3b9c9,
  accent: 0x4f7fd9,
  legend: 0x2a2f40,
  side: 0xa4abbd,
} as const;

/** Taille d'une unité de touche (en unités de grille) : le clavier fait la largeur du Kenney. */
const UNIT = 0.036;
/** Bord du boîtier autour des touches, en unités de touche. */
const MARGIN = 0.3;
const KEY_GAP = 0.14;
const CASE_HEIGHT = 0.016;
const KEY_HEIGHT = 0.012;
/** Les rangées montent un peu vers l'arrière, comme un clavier sur ses pieds. */
const ROW_RISE = 0.0018;
/** Pixels de texture par unité de touche (une lettre 3 x 5 au centre). */
const PX = 10;
/** Bande unie à droite de la texture, lue par les flancs des touches. */
const SIDE_STRIP = 4;

const COLUMNS = 15;
const ROWS = QWERTY_ROWS.length;
const WIDTH_UNITS = COLUMNS + 2 * MARGIN;
const DEPTH_UNITS = ROWS + 2 * MARGIN;

/** Largeur et profondeur du clavier, en unités de grille. */
export const KEYBOARD_SIZE = { width: WIDTH_UNITS * UNIT, depth: DEPTH_UNITS * UNIT } as const;

interface KeyPlace {
  readonly spec: KeySpec;
  /** Coin haut-gauche de la touche, en unités de touche depuis le coin du boîtier. */
  readonly x: number;
  readonly row: number;
}

function keyPlaces(): KeyPlace[] {
  return QWERTY_ROWS.flatMap((row, index) => {
    let x = MARGIN;
    return row.map((spec) => {
      const place = { spec, x, row: index };
      x += spec.width;
      return place;
    });
  });
}

/** Vue de dessus du clavier : chaque touche, sa couleur et sa lettre, plus la bande des flancs. */
export function keyboardTexture(): PixelCanvas {
  const width = Math.ceil(WIDTH_UNITS * PX);
  const canvas = new PixelCanvas(width + SIDE_STRIP, Math.ceil(DEPTH_UNITS * PX));
  canvas.fill(KEYBOARD_COLORS.case);
  canvas.rect(width, 0, SIDE_STRIP, canvas.height, KEYBOARD_COLORS.side);
  for (const { spec, x, row } of keyPlaces()) {
    const left = x * PX;
    const top = (MARGIN + row) * PX;
    const color =
      spec.kind === 'mod'
        ? KEYBOARD_COLORS.mod
        : spec.kind === 'accent'
          ? KEYBOARD_COLORS.accent
          : KEYBOARD_COLORS.key;
    canvas.rect(left, top, spec.width * PX, PX, color);
    const glyph = GLYPHS[spec.label];
    if (!glyph) continue;
    // La lettre en haut à gauche de la touche, comme sur un vrai clavier.
    glyph.forEach((line, gy) => {
      [...line].forEach((pixel, gx) => {
        if (pixel === '#') canvas.rect(left + 3 + gx, top + 2 + gy, 1, 1, KEYBOARD_COLORS.legend);
      });
    });
  }
  return canvas;
}

let keyMaterial: THREE.MeshStandardMaterial | undefined;
let caseMaterial: THREE.MeshStandardMaterial | undefined;

function materials(): { keys: THREE.MeshStandardMaterial; body: THREE.MeshStandardMaterial } {
  if (!keyMaterial) {
    const texture = keyboardTexture().texture();
    // Pixels nets quand on zoome : la police reste lisible.
    texture.magFilter = THREE.NearestFilter;
    keyMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
    keyMaterial.name = 'keycaps';
  }
  caseMaterial ??= new THREE.MeshStandardMaterial({
    color: KEYBOARD_COLORS.case,
    roughness: 0.8,
    flatShading: true,
  });
  return { keys: keyMaterial, body: caseMaterial };
}

/**
 * Clavier posé au sol (y = 0), centré, touches vers +y et rangée d'espace vers +z (côté dev).
 * Deux maillages : le boîtier et toutes les touches fusionnées.
 */
export function qwertyKeyboard(): THREE.Group {
  const { keys, body } = materials();
  const group = new THREE.Group();
  const { width, depth } = KEYBOARD_SIZE;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(width, CASE_HEIGHT, depth), body);
  shell.position.y = CASE_HEIGHT / 2;
  group.add(shell);

  const textureWidth = Math.ceil(WIDTH_UNITS * PX);
  const totalWidth = textureWidth + SIDE_STRIP;
  const textureDepth = Math.ceil(DEPTH_UNITS * PX);
  const sideU = (textureWidth + SIDE_STRIP / 2) / totalWidth;

  const boxes = keyPlaces().map(({ spec, x, row }) => {
    const w = (spec.width - KEY_GAP) * UNIT;
    const d = (1 - KEY_GAP) * UNIT;
    const geometry = new THREE.BoxGeometry(w, KEY_HEIGHT, d);
    const cx = (x + spec.width / 2) * UNIT - width / 2;
    const cz = (MARGIN + row + 0.5) * UNIT - depth / 2;
    const rise = (ROWS - 1 - row) * ROW_RISE;
    geometry.translate(cx, CASE_HEIGHT + rise + KEY_HEIGHT / 2, cz);
    return geometry;
  });
  const merged = mergeGeometries(boxes) ?? new THREE.BufferGeometry();
  for (const geometry of boxes) geometry.dispose();

  // Dessus : la case de la touche dans la vue de dessus. Flancs : la bande unie.
  const position = merged.getAttribute('position');
  const normal = merged.getAttribute('normal');
  const uv = merged.getAttribute('uv');
  if (position && normal && uv) {
    for (let i = 0; i < position.count; i++) {
      if (normal.getY(i) > 0.5) {
        const px = ((position.getX(i) + width / 2) / UNIT) * PX;
        const pz = ((position.getZ(i) + depth / 2) / UNIT) * PX;
        uv.setXY(i, px / totalWidth, 1 - pz / textureDepth);
      } else {
        uv.setXY(i, sideU, 0.5);
      }
    }
    uv.needsUpdate = true;
  }
  group.add(new THREE.Mesh(merged, keys));
  return group;
}
