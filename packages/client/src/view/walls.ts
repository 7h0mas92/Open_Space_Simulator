/**
 * Murs du bureau vus par le rendu et l'interface : où commence et finit chaque zone de mur
 * (une par pièce qui touche le mur du fond ou de gauche), et l'allure de chaque peinture ou
 * papier peint.
 *
 * Les papiers peints sont des motifs dessinés sur un canvas (aucun fichier d'image) : un motif
 * couvre une case de large et toute la hauteur du mur, et se répète le long du mur. Les mêmes
 * dessins servent de texture 3D et de vignette dans le catalogue.
 */
import { hashString, type WallFinishId, type WallZone } from '@oss/shared';
import type { OfficeLayout, Room } from './layout';
import type { WallSide } from './windows';

/** Une zone de mur sur le plan : le mur, et les cases [start, end[ qu'elle couvre. */
export interface WallZoneSpan {
  readonly zone: WallZone;
  readonly wall: WallSide;
  readonly start: number;
  readonly end: number;
}

/** Nom de zone d'une pièce le long d'un mur (`null` : pas de zone pour cette pièce). */
function zoneOf(room: Room, wall: WallSide, wing: number): WallZone | null {
  if (room.kind === 'open') return wall === 0 ? 'back-open' : 'left-open';
  if (wall === 0 && room.kind === 'kitchen') return 'back-kitchen';
  if (wall === 0 && room.kind === 'incubator' && wing >= 1 && wing <= 3)
    return `back-wing-${wing}` as WallZone;
  if (
    wall === 1 &&
    (room.kind === 'arcade' || room.kind === 'garden' || room.kind === 'auditorium')
  )
    return `left-${room.kind}`;
  return null;
}

/**
 * Zones des deux murs du fond. Une zone va du début de sa pièce au début de la pièce
 * suivante : la cloison qui les sépare prend le revêtement de la pièce d'avant.
 */
export function wallZoneSpans(layout: OfficeLayout): WallZoneSpan[] {
  const spans: WallZoneSpan[] = [];
  for (const wall of [0, 1] as const) {
    const along = (room: Room) => (wall === 0 ? room.x : room.z);
    const rooms = layout.rooms
      .filter((room) => (wall === 0 ? room.z === 0 : room.x === 0))
      .sort((a, b) => along(a) - along(b));
    const length = wall === 0 ? layout.width : layout.depth;
    let wing = 0;
    rooms.forEach((room, index) => {
      if (room.kind === 'incubator') wing++;
      const zone = zoneOf(room, wall, wing);
      if (!zone) return;
      const next = rooms[index + 1];
      spans.push({
        zone,
        wall,
        start: index === 0 ? 0 : along(room),
        end: next ? along(next) : length,
      });
    });
  }
  return spans;
}

/** Hauteur du motif en pixels pour une case de large (le mur fait 2,2 cases de haut). */
export const WALL_TILE = { width: 128, height: 282 } as const;

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

interface FinishLook {
  /** Teinte de fond (et teinte de la peinture). */
  readonly base: string;
  readonly draw?: Draw;
}

/** Petit générateur déterministe propre à un motif (jamais le hasard de la partie). */
function noise(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/** Dessine une forme en x, x - w et x + w : le motif se raccorde d'une case à l'autre. */
function wrapped(w: number, draw: (dx: number) => void): void {
  for (const dx of [-w, 0, w]) draw(dx);
}

const stripes: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#b8c9b2';
  for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 14, h);
  ctx.fillStyle = 'rgb(255 255 255 / 35%)';
  for (let x = 0; x < w; x += 32) ctx.fillRect(x + 20, 0, 3, h);
};

const dots: Draw = (ctx, w, h) => {
  ctx.fillStyle = '#e07a5f';
  for (let row = 0; row * 24 < h + 24; row++) {
    for (let x = row % 2 ? 16 : 0; x <= w; x += 32) {
      ctx.beginPath();
      ctx.arc(x, row * 24 + 12, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

const herringbone: Draw = (ctx, w, h) => {
  ctx.strokeStyle = '#6f7d90';
  ctx.lineWidth = 7;
  ctx.lineCap = 'square';
  for (let y = -8; y < h + 24; y += 24) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 32) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 16, y + 14);
      ctx.lineTo(x + 32, y);
    }
    ctx.stroke();
  }
};

const brick: Draw = (ctx, w, h) => {
  const random = noise('wall#brick');
  const shades = ['#b5533c', '#a84a35', '#c06046', '#9c4431', '#b9583f'];
  for (let row = 0, y = 0; y < h; row++, y += 14) {
    for (let x = row % 2 ? -16 : 0; x < w; x += 32) {
      ctx.fillStyle = shades[Math.floor(random() * shades.length)] ?? '#b5533c';
      ctx.fillRect(x + 1, y + 1, 30, 12);
      if (x < 0) ctx.fillRect(x + w + 1, y + 1, 30, 12);
    }
  }
};

const jungle: Draw = (ctx, w, h) => {
  const random = noise('wall#jungle');
  const greens = ['#2f7a4d', '#3f9a5c', '#256b44', '#4caf6a', '#1d5c3a'];
  for (let k = 0; k < 16; k++) {
    const x = random() * w;
    const y = random() * h;
    const angle = random() * Math.PI * 2;
    const size = 26 + random() * 22;
    ctx.fillStyle = greens[k % greens.length] ?? '#2f7a4d';
    wrapped(w, (dx) => {
      ctx.save();
      ctx.translate(x + dx, y);
      ctx.rotate(angle);
      // Feuille de palmier : une nervure et des folioles de chaque côté.
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgb(10 40 25 / 55%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      for (let f = -size + 8; f < size - 4; f += 7) {
        ctx.moveTo(f, 0);
        ctx.lineTo(f + 5, -size * 0.3);
        ctx.moveTo(f, 0);
        ctx.lineTo(f + 5, size * 0.3);
      }
      ctx.stroke();
      ctx.restore();
    });
  }
};

const wainscot: Draw = (ctx, w, h) => {
  // Deux panneaux à moulures par case : un grand en haut, un petit sous la cimaise.
  const rail = Math.round(h * 0.6);
  ctx.fillStyle = '#7d5230';
  ctx.fillRect(0, rail, w, 10);
  ctx.fillRect(0, 0, w, 8);
  ctx.fillRect(0, h - 14, w, 14);
  for (const [top, bottom] of [
    [16, rail - 8],
    [rail + 18, h - 22],
  ] as const) {
    for (const x of [8, 72]) {
      ctx.fillStyle = '#a77445';
      ctx.fillRect(x, top, 48, bottom - top);
      ctx.strokeStyle = '#6c4527';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, top + 1.5, 45, bottom - top - 3);
      ctx.strokeStyle = 'rgb(255 230 190 / 35%)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 6, top + 6, 36, bottom - top - 12);
    }
  }
};

const chalkboard: Draw = (ctx, w, h) => {
  const random = noise('wall#chalk');
  ctx.strokeStyle = 'rgb(240 240 230 / 55%)';
  ctx.fillStyle = 'rgb(240 240 230 / 50%)';
  ctx.lineWidth = 2;
  // Schéma d'archi : des boîtes reliées par des flèches, puis des lignes de « code ».
  const boxes = [
    [14, 40],
    [74, 70],
    [20, 120],
  ] as const;
  for (const [x, y] of boxes) ctx.strokeRect(x, y, 40, 22);
  ctx.beginPath();
  ctx.moveTo(54, 51);
  ctx.lineTo(74, 81);
  ctx.moveTo(74, 81);
  ctx.lineTo(54, 131);
  ctx.stroke();
  for (let y = 170; y < h - 30; y += 9) {
    const indent = Math.floor(random() * 3) * 8;
    ctx.fillRect(10 + indent, y, 20 + random() * 70, 3);
  }
  ctx.strokeStyle = 'rgb(255 220 120 / 60%)';
  ctx.beginPath();
  ctx.arc(96, 30, 12, 0, Math.PI * 2);
  ctx.stroke();
};

const artdeco: Draw = (ctx, w, h) => {
  // Écailles en éventail : demi-cercles dorés à rayons, une rangée sur deux décalée.
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d4af5a';
  for (let row = 0, y = 0; y < h + 32; row++, y += 24) {
    for (let x = row % 2 ? -16 : 0; x <= w + 16; x += 32) {
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 15, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      for (let ray = 1; ray < 6; ray++) {
        const angle = Math.PI + (ray * Math.PI) / 6;
        ctx.moveTo(x + 16, y + 16);
        ctx.lineTo(x + 16 + Math.cos(angle) * 11, y + 16 + Math.sin(angle) * 11);
      }
      ctx.stroke();
    }
  }
};

const coderain: Draw = (ctx, w, h) => {
  const random = noise('wall#rain');
  for (let x = 2; x < w; x += 10) {
    const head = random() * h;
    const length = 60 + random() * 120;
    for (let y = 0; y < h; y += 9) {
      const distance = (head - y + h) % h;
      if (distance > length) continue;
      const alpha = distance < 9 ? 1 : 0.85 - (distance / length) * 0.75;
      ctx.fillStyle = distance < 9 ? `rgb(200 255 210 / ${alpha})` : `rgb(60 220 110 / ${alpha})`;
      ctx.fillRect(x, y, 4 + Math.floor(random() * 3), 6);
    }
  }
};

export const WALL_LOOKS: Record<WallFinishId, FinishLook> = {
  cream: { base: '#ece6da' },
  sage: { base: '#a9bfa0' },
  teal: { base: '#2f6f73' },
  terracotta: { base: '#c9714f' },
  mustard: { base: '#d9a63a' },
  blush: { base: '#e7b9b4' },
  navy: { base: '#2c3a5c' },
  anthracite: { base: '#4a4d55' },
  stripes: { base: '#ece4d0', draw: stripes },
  dots: { base: '#f4e7cd', draw: dots },
  herringbone: { base: '#d8dde3', draw: herringbone },
  brick: { base: '#d9cfc4', draw: brick },
  jungle: { base: '#163d2c', draw: jungle },
  wainscot: { base: '#8f5f37', draw: wainscot },
  chalkboard: { base: '#2d3a33', draw: chalkboard },
  artdeco: { base: '#1d4b40', draw: artdeco },
  coderain: { base: '#07140c', draw: coderain },
};

/** Un revêtement a-t-il un motif (papier peint) ou n'est-il qu'une teinte (peinture) ? */
export function hasPattern(finish: WallFinishId): boolean {
  return WALL_LOOKS[finish].draw !== undefined;
}

/** Teinte d'une peinture (ou fond d'un papier peint), en nombre pour Three.js. */
export function finishHex(finish: WallFinishId): number {
  return Number.parseInt(WALL_LOOKS[finish].base.slice(1), 16);
}

/** Dessine le motif d'une case de mur sur un canvas (`null` sans canvas, en test). */
export function drawWallTile(finish: WallFinishId): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = WALL_TILE.width;
  canvas.height = WALL_TILE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const look = WALL_LOOKS[finish];
  ctx.fillStyle = look.base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  look.draw?.(ctx, canvas.width, canvas.height);
  return canvas;
}
