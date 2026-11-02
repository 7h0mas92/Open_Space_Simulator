/**
 * Objets débloqués par le mode Histoire, en formes Three.js (aucun modèle Kenney ne s'en
 * approche) : la statue de licorne et la cloche de la Bourse. Comme les autres meubles, chacun
 * est fusionné par matériau (voir `pieces.ts`), tient sur une case et regarde vers +z.
 */
import * as THREE from 'three';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

const MARBLE = 0xf1eee8;
const MARBLE_VEIN = 0xc9c4bb;
const BRONZE = 0x9c6b2f;
const ROPE = 0xd8c08a;

/** Statue de licorne : socle de marbre à moulures, licorne dorée cabrée, corne torsadée. */
export function unicornStatue(): THREE.Group {
  const p = new Pieces([PALETTE.gold]);
  // Socle : plinthe, dé et corniche, une plaque dorée devant.
  p.box(0.62, 0.08, 0.62, MARBLE_VEIN, [0, 0, 0]);
  p.box(0.52, 0.5, 0.52, MARBLE, [0, 0.08, 0]);
  p.box(0.58, 0.06, 0.58, MARBLE_VEIN, [0, 0.58, 0]);
  p.box(0.22, 0.07, 0.01, PALETTE.gold, [0, 0.36, 0.262]);
  const top = 0.64;
  // Corps et pattes (les antérieures levées : la licorne se cabre).
  p.shape(
    new THREE.SphereGeometry(0.13, 10, 8).scale(1.5, 0.95, 0.9),
    PALETTE.gold,
    [0, top + 0.3, 0],
    {
      z: 0.35,
    },
  );
  for (const z of [-0.06, 0.06]) {
    p.bar([-0.12, top + 0.25, z], [-0.15, top, z], 0.026, PALETTE.gold);
    p.bar([0.1, top + 0.36, z], [0.2, top + 0.27, z + 0.01], 0.024, PALETTE.gold);
    p.bar([0.2, top + 0.27, z], [0.25, top + 0.36, z], 0.022, PALETTE.gold);
  }
  // Encolure, tête, oreilles et corne.
  p.bar([0.12, top + 0.38, 0], [0.2, top + 0.58, 0], 0.06, PALETTE.gold);
  p.shape(new THREE.BoxGeometry(0.17, 0.08, 0.08), PALETTE.gold, [0.26, top + 0.6, 0], { z: -0.5 });
  for (const z of [-0.025, 0.025])
    p.shape(new THREE.ConeGeometry(0.015, 0.05, 5), PALETTE.gold, [0.19, top + 0.67, z]);
  p.shape(new THREE.ConeGeometry(0.018, 0.16, 6), MARBLE, [0.25, top + 0.7, 0], { z: -0.55 });
  // Crinière et queue en éventail.
  for (let k = 0; k < 4; k++)
    p.shape(
      new THREE.BoxGeometry(0.05, 0.08, 0.012),
      PALETTE.gold,
      [0.11 + k * 0.025, top + 0.44 + k * 0.05, -0.04],
      { z: 0.6 },
    );
  p.shape(new THREE.ConeGeometry(0.05, 0.22, 6), PALETTE.gold, [-0.25, top + 0.22, 0], { z: -0.5 });
  return p.build('unicornStatue');
}

/** Cloche de la Bourse : portique en bois, cloche de bronze, battant et corde à pompon. */
export function ipoBell(): THREE.Group {
  const p = new Pieces([PALETTE.woodDark]);
  // Pied lesté et portique.
  p.box(0.7, 0.06, 0.4, PALETTE.woodDark, [0, 0, 0]);
  for (const x of [-0.28, 0.28]) {
    p.box(0.07, 1.25, 0.07, PALETTE.woodDark, [x, 0.06, 0]);
    p.box(0.14, 0.05, 0.3, PALETTE.wood, [x, 0.06, 0]);
  }
  p.box(0.72, 0.08, 0.1, PALETTE.woodDark, [0, 1.31, 0]);
  p.box(0.3, 0.05, 0.012, PALETTE.gold, [0, 1.32, 0.052]);
  // Cloche : une cloche tournée (profil), sa lèvre et sa couronne.
  const profile = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.19, 0),
    new THREE.Vector2(0.17, 0.04),
    new THREE.Vector2(0.13, 0.12),
    new THREE.Vector2(0.11, 0.24),
    new THREE.Vector2(0.09, 0.3),
    new THREE.Vector2(0.0, 0.32),
  ];
  p.shape(new THREE.LatheGeometry(profile, 16), BRONZE, [0, 0.9, 0]);
  p.post(0.195, 0.195, 0.02, PALETTE.gold, [0, 0.9, 0], 16);
  p.post(0.03, 0.04, 0.09, BRONZE, [0, 1.22, 0], 8);
  p.shape(new THREE.SphereGeometry(0.035, 8, 6), PALETTE.dark, [0, 0.86, 0]);
  // Corde qui pend, nouée d'un pompon.
  p.bar([0.0, 0.86, 0.02], [0.06, 0.45, 0.06], 0.008, ROPE, 5);
  p.shape(new THREE.ConeGeometry(0.03, 0.08, 8), PALETTE.red, [0.06, 0.41, 0.06]);
  return p.build('ipoBell');
}
