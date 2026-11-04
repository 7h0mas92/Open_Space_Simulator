/**
 * Interpolation entre deux ticks : le rendu affiche un état « entre » l'avant-dernier et le
 * dernier instantané. C'est ce qui rend le x4 fluide même si la logique avance par pas fixes.
 */
import type { AgentSnapshot } from '../ai/agents';
import { lerp } from '../engine/interpolation';

export { lerp };

/** Interpolation d'angle par le plus court chemin. */
export function lerpAngle(a: number, b: number, t: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

export function interpolateAgent(
  previous: AgentSnapshot | undefined,
  current: AgentSnapshot,
  alpha: number,
): AgentSnapshot {
  // Un personnage qui (ré)apparaît se téléporte : pas de glissade depuis l'ancienne position.
  if (!previous || previous.visible !== current.visible) return current;
  const t = Math.min(1, Math.max(0, alpha));
  return {
    ...current,
    x: lerp(previous.x, current.x, t),
    z: lerp(previous.z, current.z, t),
    facing: lerpAngle(previous.facing, current.facing, t),
  };
}
