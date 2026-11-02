/**
 * Sols du bureau vus par le rendu et l'interface : quelle pièce du plan correspond à chaque
 * zone de sol, et l'allure de chaque matière dans chaque teinte.
 *
 * Les matières sont des motifs dessinés sur un canvas (aucun fichier d'image) : un motif couvre
 * une case et se raccorde à ses voisines, il se répète sur toute la pièce. Le même dessin sert
 * de texture 3D et de vignette dans le catalogue.
 */
import {
  hashString,
  type FloorFinish,
  type FloorMaterialId,
  type FloorTint,
  type FloorZone,
} from '@oss/shared';
import type { OfficeLayout, Room } from './layout';

/** Une pièce du plan et sa zone de sol. */
export interface FloorZoneRoom {
  readonly zone: FloorZone;
  readonly room: Room;
}

/** Zones de sol des pièces du plan (les ailes sont numérotées dans l'ordre du plan). */
export function floorZoneRooms(layout: OfficeLayout): FloorZoneRoom[] {
  const rooms: FloorZoneRoom[] = [];
  let wing = 0;
  for (const room of layout.rooms) {
    if (room.kind === 'incubator') {
      wing++;
      if (wing <= 3) rooms.push({ zone: `wing-${wing}` as FloorZone, room });
    } else {
      rooms.push({ zone: room.kind, room });
    }
  }
  return rooms;
}

/**
 * Rectangle de sol d'une pièce, en coordonnées de la scène : la pièce et la moitié des
 * cloisons qui l'entourent (deux pièces voisines se partagent la case de la cloison), sans
 * déborder du bureau.
 */
export function floorRect(
  room: Room,
  layout: Pick<OfficeLayout, 'width' | 'depth'>,
): { x0: number; x1: number; z0: number; z1: number } {
  return {
    x0: Math.max(-0.5, room.x - 1),
    x1: Math.min(layout.width - 0.5, room.x + room.width),
    z0: Math.max(-0.5, room.z - 1),
    z1: Math.min(layout.depth - 0.5, room.z + room.depth),
  };
}

/** Taille d'une case de sol en pixels. */
export const FLOOR_TILE = 128;

/** Teinte de base de chaque teinte de sol. */
export const FLOOR_TINT_COLORS: Record<FloorTint, string> = {
  white: '#ebe7df',
  pearl: '#d2d1cc',
  sand: '#d8c6a6',
  taupe: '#a69a8b',
  grey: '#a2a4a6',
  slate: '#7a8693',
  sage: '#a7b69f',
  charcoal: '#4b4d51',
  'oak-light': '#d9bb8e',
  oak: '#bb8b59',
  'oak-smoked': '#80603f',
  walnut: '#5f4231',
};

/** Brillance de chaque matière (rugosité du matériau 3D). */
export const FLOOR_ROUGHNESS: Record<FloorMaterialId, number> = {
  vinyl: 0.75,
  carpet: 1,
  concrete: 0.6,
  tiles: 0.45,
  planks: 0.7,
  chevron: 0.65,
  terrazzo: 0.5,
  marble: 0.3,
  datacenter: 0.55,
  checker: 0.4,
};

type Draw = (ctx: CanvasRenderingContext2D, base: string, random: () => number) => void;

/** Petit générateur déterministe propre à un motif (jamais le hasard de la partie). */
function noise(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/** Éclaircit (f > 1) ou assombrit (f < 1) une teinte `#rrggbb`. */
export function shade(hex: string, f: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 0xff;
    const out = f >= 1 ? c + (255 - c) * (f - 1) : c * f;
    return Math.round(Math.max(0, Math.min(255, out)));
  };
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

/** Dessine une forme en x ± S et y ± S : le motif se raccorde d'une case à l'autre. */
function wrapped(draw: (dx: number, dy: number) => void): void {
  for (const dx of [-FLOOR_TILE, 0, FLOOR_TILE])
    for (const dy of [-FLOOR_TILE, 0, FLOOR_TILE]) draw(dx, dy);
}

/** Grain fin : des points un peu plus clairs ou plus sombres. */
function speckle(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  alpha: number,
) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = random() < 0.5 ? `rgb(0 0 0 / ${alpha})` : `rgb(255 255 255 / ${alpha})`;
    ctx.fillRect(Math.floor(random() * FLOOR_TILE), Math.floor(random() * FLOOR_TILE), 1, 1);
  }
}

/** Taches douces (béton, marbre) : des dégradés ronds raccordés d'une case à l'autre. */
function clouds(ctx: CanvasRenderingContext2D, random: () => number, count: number, alpha: number) {
  for (let i = 0; i < count; i++) {
    const x = random() * FLOOR_TILE;
    const y = random() * FLOOR_TILE;
    const r = 18 + random() * 40;
    const tone = random() < 0.5 ? '0 0 0' : '255 255 255';
    wrapped((dx, dy) => {
      const gradient = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gradient.addColorStop(0, `rgb(${tone} / ${alpha})`);
      gradient.addColorStop(1, `rgb(${tone} / 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }
}

/** Joints d'un carrelage : `count` carreaux par côté, le joint à cheval sur les bords. */
function grout(ctx: CanvasRenderingContext2D, color: string, count: number, width: number) {
  const step = FLOOR_TILE / count;
  ctx.fillStyle = color;
  for (let k = 0; k <= count; k++) {
    const p = k * step - width / 2;
    ctx.fillRect(p, 0, width, FLOOR_TILE);
    ctx.fillRect(0, p, FLOOR_TILE, width);
  }
}

/** Veinage du bois le long d'une lame horizontale. */
function grain(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
) {
  ctx.lineWidth = 1;
  for (let line = 0; line < 4; line++) {
    const y = y0 + 3 + random() * (y1 - y0 - 6);
    const wave = 0.6 + random() * 1.4;
    ctx.strokeStyle = random() < 0.6 ? 'rgb(60 35 15 / 13%)' : 'rgb(255 240 210 / 12%)';
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      const yy = y + Math.sin((x + line * 37) / (14 + line * 5)) * wave;
      if (x === x0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

const vinyl: Draw = (ctx, _base, random) => {
  clouds(ctx, random, 6, 0.04);
  speckle(ctx, random, 900, 0.07);
};

/** Dalles de moquette : 2 x 2 par case, tournées d'un quart de tour une sur deux. */
const carpet: Draw = (ctx, base, random) => {
  const half = FLOOR_TILE / 2;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = shade(base, (i + j) % 2 === 0 ? 1.015 : 0.975);
      ctx.fillRect(i * half, j * half, half, half);
      // Les fibres de la dalle, dans un sens ou dans l'autre.
      ctx.strokeStyle = 'rgb(0 0 0 / 5%)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 2; k < half; k += 4) {
        if ((i + j) % 2 === 0) {
          ctx.moveTo(i * half + k, j * half);
          ctx.lineTo(i * half + k, j * half + half);
        } else {
          ctx.moveTo(i * half, j * half + k);
          ctx.lineTo(i * half + half, j * half + k);
        }
      }
      ctx.stroke();
    }
  speckle(ctx, random, 2200, 0.08);
  grout(ctx, 'rgb(0 0 0 / 10%)', 2, 1);
};

const concrete: Draw = (ctx, _base, random) => {
  clouds(ctx, random, 14, 0.07);
  speckle(ctx, random, 500, 0.06);
  // Quelques micro-fissures très discrètes.
  ctx.strokeStyle = 'rgb(0 0 0 / 7%)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    let x = random() * FLOOR_TILE;
    let y = random() * FLOOR_TILE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (random() - 0.5) * 14;
      y += 4 + random() * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

/** Grands carreaux : 2 x 2 par case, une nuance par carreau, joints fins. */
const tiles: Draw = (ctx, base, random) => {
  const half = FLOOR_TILE / 2;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = shade(base, 0.97 + random() * 0.06);
      ctx.fillRect(i * half, j * half, half, half);
    }
  clouds(ctx, random, 4, 0.03);
  const dark = Number.parseInt(base.slice(1, 3), 16) < 110;
  grout(ctx, dark ? 'rgb(255 255 255 / 22%)' : 'rgb(0 0 0 / 18%)', 2, 2);
};

/** Parquet en lames : 4 lames par case, joints décalés d'une rangée à l'autre. */
const planks: Draw = (ctx, base, random) => {
  const rows = 4;
  const height = FLOOR_TILE / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * height;
    const joint = Math.floor(((r * 0.37 + 0.11) % 1) * FLOOR_TILE);
    // Une lame traverse la case en se raccordant à la suivante : deux tons de part et d'autre
    // du joint.
    ctx.fillStyle = shade(base, 0.92 + random() * 0.14);
    ctx.fillRect(0, y, joint, height);
    ctx.fillStyle = shade(base, 0.92 + random() * 0.14);
    ctx.fillRect(joint, y, FLOOR_TILE - joint, height);
    grain(ctx, random, 0, FLOOR_TILE, y, y + height);
    ctx.fillStyle = 'rgb(40 20 5 / 28%)';
    ctx.fillRect(joint, y, 1, height);
    ctx.fillRect(0, y, FLOOR_TILE, 1);
  }
};

/** Parquet en chevrons (point de Hongrie) : lames à 45°, qui se rejoignent au milieu. */
const chevron: Draw = (ctx, base, random) => {
  const half = FLOOR_TILE / 2;
  const band = 32;
  const count = FLOOR_TILE / band;
  const tones = Array.from({ length: count * 2 }, () => shade(base, 0.9 + random() * 0.16));
  for (const side of [0, 1]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(side * half, 0, half, FLOOR_TILE);
    ctx.clip();
    for (let k = -3; k < count + 1; k++) {
      const c = k * band;
      const tone = tones[side * count + (((k % count) + count) % count)] ?? base;
      // Colonne de gauche : les lames montent vers la droite ; à droite, l'inverse.
      const points =
        side === 0
          ? [
              [0, c],
              [half, c + half],
              [half, c + half + band],
              [0, c + band],
            ]
          : [
              [half, c + half],
              [FLOOR_TILE, c],
              [FLOOR_TILE, c + band],
              [half, c + half + band],
            ];
      ctx.fillStyle = tone;
      ctx.beginPath();
      points.forEach(([x = 0, y = 0], index) =>
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
      );
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgb(40 20 5 / 26%)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = 'rgb(40 20 5 / 26%)';
  ctx.fillRect(half - 0.5, 0, 1, FLOOR_TILE);
  ctx.fillRect(0, 0, 1, FLOOR_TILE);
  speckle(ctx, random, 400, 0.05);
};

/** Terrazzo : éclats de pierre de couleurs douces dans un fond uni. */
const terrazzo: Draw = (ctx, base, random) => {
  speckle(ctx, random, 700, 0.06);
  const chips = ['#f4f1ea', '#8f8c87', '#3f4044', '#c9a27c', '#b8705a', '#d8d2c4'];
  for (let i = 0; i < 70; i++) {
    const x = random() * FLOOR_TILE;
    const y = random() * FLOOR_TILE;
    const r = 1.5 + random() * random() * 6;
    const sides = 4 + Math.floor(random() * 3);
    const turn = random() * Math.PI;
    const color = chips[Math.floor(random() * chips.length)] ?? base;
    wrapped((dx, dy) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let s = 0; s < sides; s++) {
        const angle = turn + (s / sides) * Math.PI * 2;
        const rr = r * (0.7 + ((s * 7) % 5) / 10);
        const px = x + dx + Math.cos(angle) * rr;
        const py = y + dy + Math.sin(angle) * rr;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });
  }
};

/** Marbre : une grande dalle veinée par case, joint très fin. */
const marble: Draw = (ctx, base, random) => {
  clouds(ctx, random, 8, 0.05);
  const dark = Number.parseInt(base.slice(1, 3), 16) < 110;
  for (let v = 0; v < 3; v++) {
    ctx.strokeStyle = dark ? 'rgb(255 255 255 / 22%)' : 'rgb(70 70 80 / 22%)';
    ctx.lineWidth = v === 0 ? 1.6 : 0.8;
    let x = random() * FLOOR_TILE;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (y < FLOOR_TILE) {
      const nx = x + (random() - 0.4) * 30;
      const ny = y + 12 + random() * 18;
      ctx.quadraticCurveTo(x + (random() - 0.5) * 20, (y + ny) / 2, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
  grout(ctx, dark ? 'rgb(255 255 255 / 18%)' : 'rgb(0 0 0 / 12%)', 1, 1.5);
};

/** Dalles techniques : 2 x 2 dalles perforées par case, et un voyant vert sur l'une d'elles. */
const datacenter: Draw = (ctx, base, random) => {
  const half = FLOOR_TILE / 2;
  for (const [x, y] of [
    [0, 0],
    [half, 0],
    [0, half],
    [half, half],
  ] as const) {
    ctx.fillStyle = shade(base, 1.06);
    ctx.fillRect(x + 2, y + 2, half - 4, half - 4);
    ctx.fillStyle = 'rgb(0 0 0 / 28%)';
    for (let py = y + 8; py < y + half - 6; py += 6)
      for (let px = x + 8; px < x + half - 6; px += 6) ctx.fillRect(px, py, 2, 2);
  }
  grout(ctx, 'rgb(0 0 0 / 35%)', 2, 2);
  ctx.fillStyle = random() < 0.5 ? '#3ddc84' : '#4fc3f7';
  ctx.fillRect(half - 7, half - 7, 4, 4);
};

/** Damier rétro : 2 x 2 carreaux par case, la teinte et un blanc cassé en alternance. */
const checker: Draw = (ctx, base, random) => {
  const half = FLOOR_TILE / 2;
  ctx.fillStyle = '#efeae0';
  ctx.fillRect(half, 0, half, half);
  ctx.fillRect(0, half, half, half);
  ctx.fillStyle = shade(base, 0.92);
  ctx.fillRect(0, 0, half, half);
  ctx.fillRect(half, half, half, half);
  speckle(ctx, random, 300, 0.05);
  grout(ctx, 'rgb(0 0 0 / 16%)', 2, 1);
};

const DRAWS: Record<FloorMaterialId, Draw> = {
  vinyl,
  carpet,
  concrete,
  tiles,
  planks,
  chevron,
  terrazzo,
  marble,
  datacenter,
  checker,
};

/** Clé d'un sol (`planks:oak`). */
export function floorKey(finish: FloorFinish): string {
  return `${finish.material}:${finish.tint}`;
}

/** Dessine une case d'un sol sur un canvas (`null` sans canvas, en test). */
export function drawFloorTile(finish: FloorFinish): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = FLOOR_TILE;
  canvas.height = FLOOR_TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const base = FLOOR_TINT_COLORS[finish.tint];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, FLOOR_TILE, FLOOR_TILE);
  DRAWS[finish.material](ctx, base, noise(`floor#${floorKey(finish)}`));
  return canvas;
}
