import * as THREE from 'three';
import { RIVALS, type RivalId } from '@oss/shared';
import type { MarketView } from '../view/types';
import type { LightingState } from './lighting';
import type { RivalSpot } from './skyline';

/**
 * Mode Histoire, longue partie : les enseignes lumineuses des startups rivales sur les toits de
 * la ville (tours choisies par `rivalTowerSpots`, derrière le bureau, jamais devant). L'enseigne
 * grandit avec la part de marché du rival, brille la nuit et s'éteint s'il fait faillite ou s'il
 * est racheté. Rendu seulement : rien ne remonte vers la simulation.
 */

const SIGN_HEIGHT = 2.4;

function signTexture(name: string, color: string): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Sign {
  readonly group: THREE.Group;
  readonly material: THREE.MeshStandardMaterial;
}

export class RivalTowers {
  readonly root = new THREE.Group();
  private signs = new Map<RivalId, Sign>();
  private panels = new Map<RivalId, THREE.Mesh>();
  private spotsKey = '';

  constructor() {
    this.root.name = 'rival-towers';
  }

  /** Place les enseignes sur les toits choisis (à chaque changement de ville). */
  setSpots(spots: readonly RivalSpot[]): void {
    const key = spots.map((s) => `${s.x},${s.z}`).join(';');
    if (key === this.spotsKey) return;
    this.spotsKey = key;
    this.dispose();
    RIVALS.forEach((rival, index) => {
      const spot = spots[index];
      if (!spot) return;
      const texture = signTexture(rival.name, rival.color);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: texture,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide,
      });
      const group = new THREE.Group();
      group.name = `rival-${rival.id}`;
      // Mât d'enseigne du toit jusque sous la ligne `limit`, panneau en haut, tourné vers la
      // caméra isométrique (qui regarde depuis +x, +z).
      const poleHeight = Math.max(0.5, spot.limit - SIGN_HEIGHT - spot.y);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_HEIGHT * 4, SIGN_HEIGHT), material);
      panel.position.y = poleHeight + SIGN_HEIGHT / 2;
      panel.rotation.y = Math.PI / 4;
      const pole = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, poleHeight, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x2b2f3a }),
      );
      pole.position.y = poleHeight / 2;
      group.add(pole, panel);
      group.position.set(spot.x, spot.y, spot.z);
      this.panels.set(rival.id, panel);
      group.visible = false;
      this.root.add(group);
      this.signs.set(rival.id, { group, material });
    });
  }

  /** Enseignes du marché en cours (`null` hors de l'histoire : tout est caché). */
  update(market: MarketView | null, light: LightingState): void {
    for (const [id, sign] of this.signs) {
      const rival = market?.rivals.find((r) => r.id === id);
      sign.group.visible = Boolean(rival?.alive);
      if (!rival?.alive) continue;
      // L'enseigne s'élargit avec la part de marché (sa hauteur reste sous la ligne `limit`).
      const panel = this.panels.get(id);
      if (panel) panel.scale.x = 0.6 + Math.min(1, rival.share * 2);
      sign.material.emissiveIntensity = 0.35 + (1 - light.daylight) * 1.4;
    }
  }

  dispose(): void {
    for (const { group, material } of this.signs.values()) {
      this.root.remove(group);
      material.map?.dispose();
      material.dispose();
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (child.material !== material) (child.material as THREE.Material).dispose();
      });
    }
    this.signs.clear();
    this.panels.clear();
  }
}
