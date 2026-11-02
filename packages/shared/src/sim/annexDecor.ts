import { z } from 'zod';
import { ANNEX_KINDS, ANNEXES, type AnnexKind } from './funding.js';
import type { FurnitureId } from './furniture.js';
import { GridPositionSchema } from './components.js';

/**
 * Décor offert avec chaque annexe (salle d'arcade, jardin intérieur, auditorium). Ces objets
 * sont aussi en vente dans la boutique, mais ceux de l'annexe sont du décor : sans effet, ni
 * revente, ni rangement. Le joueur peut seulement les déplacer et les tourner.
 *
 * Ils ne sont pas des entités de la simulation (un nouvel identifiant décalerait ceux des
 * objets et des devs suivants, et les replays ne retrouveraient plus leurs commandes) : leur
 * place d'origine est calculée par le plan du bureau, et l'état ne garde que leurs
 * déplacements (`annexDecor`), sans aucun tirage.
 */
export const ANNEX_DECOR: Record<AnnexKind, readonly FurnitureId[]> = {
  arcade: ['arcade-cabinet', 'arcade-cabinet', 'neon-sign', 'pinball', 'arcade-cabinet'],
  garden: ['indoor-tree', 'bench', 'fountain', 'plant', 'indoor-tree'],
  auditorium: ['speaker', 'stage', 'auditorium-screen', 'lectern', 'speaker'],
};

/** Clé d'un objet du décor : « annexe-rang » (par ex. « 0-3 », le flipper de l'arcade). */
export function annexDecorKey(annex: number, index: number): string {
  return `${annex}-${index}`;
}

/** Objet du décor désigné par une clé, si son annexe est ouverte. */
export function annexDecorItem(key: string, annexes: number): FurnitureId | undefined {
  const match = /^(\d)-(\d)$/.exec(key);
  if (!match) return undefined;
  const annex = Number(match[1]);
  if (annex >= Math.min(annexes, ANNEXES.max)) return undefined;
  const kind = ANNEX_KINDS[annex];
  return kind ? ANNEX_DECOR[kind][Number(match[2])] : undefined;
}

/** Nouvelle place d'un objet du décor (même repère que le mobilier : y = profondeur). */
export const AnnexDecorPlacementSchema = z.object({
  x: GridPositionSchema,
  y: GridPositionSchema,
  rotation: z.number().int().min(0).max(3),
});
export type AnnexDecorPlacement = z.infer<typeof AnnexDecorPlacementSchema>;

/** Déplacements du décor des annexes, par clé (absent : l'objet est à sa place d'origine). */
export const AnnexDecorSchema = z.record(z.string().max(8), AnnexDecorPlacementSchema);
export type AnnexDecor = z.infer<typeof AnnexDecorSchema>;
