/**
 * Comptoir d'accueil du hall d'entrée, en formes Three.js (le Furniture Kit de Kenney n'en a
 * pas, voir l'asset manquant `receptionDesk`). Offert avec le hall, et en vente dans la boutique.
 * Posé au sol, centré sur son emprise, la façade des visiteurs vers +z.
 */
import type * as THREE from 'three';
import { Pieces } from './pieces';
import { PALETTE } from './primitives';

const STONE = 0xd9d4ca;

/** Comptoir d'accueil (3 x 1) : façade en bois, plateau de pierre, deux écrans, un registre. */
export function receptionDesk(): THREE.Group {
  const pieces = new Pieces([PALETTE.wood]);
  // Façade côté visiteurs (+z), haute, et retour plus bas côté secrétaires.
  pieces.box(2.9, 0.72, 0.12, PALETTE.wood, [0, 0, 0.36]);
  pieces.box(0.12, 0.72, 0.8, PALETTE.wood, [-1.39, 0, 0]);
  pieces.box(0.12, 0.72, 0.8, PALETTE.wood, [1.39, 0, 0]);
  pieces.box(2.96, 0.04, 0.3, STONE, [0, 0.72, 0.32]); // tablette des visiteurs
  pieces.box(2.7, 0.04, 0.55, STONE, [0, 0.48, 0.02]); // plan de travail
  pieces.box(2.9, 0.05, 0.02, PALETTE.woodDark, [0, 0.62, 0.43]); // filet de façade
  for (const x of [-0.65, 0.65]) {
    // Écrans tournés vers les secrétaires (-z), clavier devant elles.
    pieces.box(0.06, 0.12, 0.04, PALETTE.dark, [x, 0.52, 0.14]); // pied d'écran
    pieces.box(0.42, 0.26, 0.03, PALETTE.dark, [x, 0.6, 0.12]);
    pieces.light(0.38, 0.22, 0.005, 0x3d6db5, [x, 0.62, 0.1]);
    pieces.box(0.34, 0.015, 0.12, 0xe9e6df, [x, 0.52, -0.12]); // clavier
  }
  pieces.box(0.32, 0.03, 0.22, 0x9b2f2f, [0.05, 0.76, 0.3]); // registre des visiteurs
  pieces.box(0.06, 0.1, 0.06, PALETTE.gold, [-0.25, 0.76, 0.3]); // sonnette
  return pieces.build('reception-desk');
}
