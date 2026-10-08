/**
 * Petite toile en mémoire pour fabriquer des textures procédurales (écrans, halos de lumière)
 * sans `<canvas>` : uniquement des rectangles et des dégradés, écrits pixel par pixel.
 *
 * Avantages : aucune police ni image à charger, rendu identique sur tous les navigateurs, et
 * testable dans Vitest (jsdom n'a pas de contexte 2D).
 */
import * as THREE from 'three';

/** Petit générateur pseudo-aléatoire (LCG) : les textures sont identiques à chaque lancement. */
export function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export class PixelCanvas {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
  }

  /** Rectangle plein ; `y` compté depuis le haut, comme sur un écran. */
  rect(x: number, y: number, w: number, h: number, color: number, alpha = 1): this {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const x0 = Math.max(0, Math.floor(x));
    const x1 = Math.min(this.width, Math.floor(x + w));
    const y0 = Math.max(0, Math.floor(y));
    const y1 = Math.min(this.height, Math.floor(y + h));
    for (let py = y0; py < y1; py++) {
      // Les DataTexture commencent par la ligne du bas : on retourne l'axe vertical.
      const row = (this.height - 1 - py) * this.width;
      for (let px = x0; px < x1; px++) {
        const i = (row + px) * 4;
        this.data[i] = Math.round(r * alpha + (this.data[i] ?? 0) * (1 - alpha));
        this.data[i + 1] = Math.round(g * alpha + (this.data[i + 1] ?? 0) * (1 - alpha));
        this.data[i + 2] = Math.round(b * alpha + (this.data[i + 2] ?? 0) * (1 - alpha));
        this.data[i + 3] = 255;
      }
    }
    return this;
  }

  fill(color: number): this {
    return this.rect(0, 0, this.width, this.height, color);
  }

  /** Couleur (0xRRGGBB) d'un pixel, `y` compté depuis le haut. Sert aux tests. */
  pixel(x: number, y: number): number {
    const i = ((this.height - 1 - y) * this.width + x) * 4;
    return ((this.data[i] ?? 0) << 16) | ((this.data[i + 1] ?? 0) << 8) | (this.data[i + 2] ?? 0);
  }

  texture(): THREE.DataTexture {
    const texture = new THREE.DataTexture(this.data, this.width, this.height);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}

/**
 * Disque blanc dont l'opacité décroît du centre vers le bord (halo, flaque de lumière).
 * `falloff` > 1 resserre la lumière au centre.
 */
export function radialGlowTexture(size = 64, falloff = 2): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - half, y - half) / half);
      const value = Math.round(255 * Math.pow(1 - d, falloff));
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = value;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Rectangle blanc aux bords adoucis (tache de soleil d'une fenêtre). `edge` : part floutée. */
export function softRectTexture(size = 64, edge = 0.25): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const ramp = (t: number) => Math.min(1, Math.min(t, 1 - t) / edge);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.round(255 * ramp((x + 0.5) / size) * ramp((y + 0.5) / size));
      data.fill(value, (y * size + x) * 4, (y * size + x) * 4 + 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
