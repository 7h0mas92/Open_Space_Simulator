import { describe, expect, it } from 'vitest';
import { EDGE_ZONE, edgePanVelocity, exitPoint } from '../../../src/render/edgePan';

describe('edgePanVelocity', () => {
  it('ne bouge pas au centre de la scène', () => {
    expect(edgePanVelocity(500, 400, 1000, 800)).toEqual({ vx: 0, vy: 0 });
  });

  it('accélère en approchant du bord', () => {
    const far = edgePanVelocity(1000 - EDGE_ZONE * 0.75, 400, 1000, 800).vx;
    const close = edgePanVelocity(1000 - EDGE_ZONE * 0.25, 400, 1000, 800).vx;
    expect(far).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(far);
    expect(close).toBeLessThan(1);
  });

  it('va à pleine vitesse sur le bord et au-delà, dans la bonne direction', () => {
    expect(edgePanVelocity(0, 400, 1000, 800)).toEqual({ vx: -1, vy: 0 });
    expect(edgePanVelocity(1001, 400, 1000, 800)).toEqual({ vx: 1, vy: 0 });
    expect(edgePanVelocity(500, -1, 1000, 800)).toEqual({ vx: 0, vy: -1 });
    expect(edgePanVelocity(500, 801, 1000, 800)).toEqual({ vx: 0, vy: 1 });
  });

  it('défile en diagonale dans un coin', () => {
    expect(edgePanVelocity(-1, 801, 1000, 800)).toEqual({ vx: -1, vy: 1 });
  });

  it('ignore une scène sans taille', () => {
    expect(edgePanVelocity(0, 0, 0, 0)).toEqual({ vx: 0, vy: 0 });
  });
});

describe('exitPoint', () => {
  it('pousse au-delà du bord par lequel la souris est sortie', () => {
    expect(exitPoint(3, 400, 1000, 800)).toEqual({ x: -1, y: 400 });
    expect(exitPoint(500, 798, 1000, 800)).toEqual({ x: 500, y: 801 });
    expect(exitPoint(999, 1, 1000, 800)).toEqual({ x: 1001, y: -1 });
  });

  it('choisit le bord le plus proche après une sortie rapide', () => {
    expect(exitPoint(900, 300, 1000, 800)).toEqual({ x: 1001, y: 300 });
    expect(exitPoint(500, 100, 1000, 800)).toEqual({ x: 500, y: -1 });
  });

  it('donne une vitesse pleine une fois sortie', () => {
    const out = exitPoint(10, 400, 1000, 800);
    expect(edgePanVelocity(out.x, out.y, 1000, 800)).toEqual({ vx: -1, vy: 0 });
  });
});
