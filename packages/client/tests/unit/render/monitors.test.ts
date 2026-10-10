import * as THREE from 'three';
import { MONITOR_MODELS, MONITOR_MOUNTS, MONITOR_SIZES, type MonitorChoice } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import {
  MONITOR_ANCHORS,
  buildMonitor,
  monitorKey,
  monitorLayout,
  monitorOfItem,
  monitorScreen,
  parseMonitorKey,
} from '../../../src/render/monitors';

const ALL: MonitorChoice[] = MONITOR_MODELS.flatMap((model) =>
  MONITOR_SIZES.flatMap((size) => MONITOR_MOUNTS.map((mount) => ({ model, size, mount }))),
);

describe('écrans des postes de travail', () => {
  it('chaque écran tient sur le plateau de chaque poste, sans déborder', () => {
    for (const kind of Object.keys(MONITOR_ANCHORS)) {
      const anchor = MONITOR_ANCHORS[kind]!;
      for (const choice of ALL) {
        const layout = monitorLayout(kind, choice)!;
        const box = new THREE.Box3().setFromObject(buildMonitor(kind, choice));
        const label = `${kind} ${monitorKey(kind, choice)}`;
        expect(box.isEmpty(), label).toBe(false);
        expect(layout.origin[0] + box.min.x, label).toBeGreaterThanOrEqual(-anchor.halfWidth);
        expect(layout.origin[0] + box.max.x, label).toBeLessThanOrEqual(anchor.halfWidth);
        // Rien ne dépasse derrière le plateau (le bras se pince sur son bord arrière).
        expect(box.min.z, label).toBeGreaterThan(anchor.back - 0.03);
      }
    }
  });

  it('l’écran livré garde la place de l’ancien écran du bureau', () => {
    const screen = monitorScreen('desk', monitorOfItem({ kind: 'desk' })!)!;
    expect(screen.at[0]).toBeCloseTo(-0.35);
    expect(screen.at[1]).toBeGreaterThan(1);
    expect(screen.at[1]).toBeLessThan(1.25);
    expect(screen.bend).toBeUndefined();
    expect(monitorOfItem({ kind: 'sofa' })).toBeNull();
  });

  it('un bras monte l’écran plus haut, l’incurvé courbe sa dalle', () => {
    const stand = monitorScreen('desk', { model: 'office', size: 'medium', mount: 'stand' })!;
    const arm = monitorScreen('desk', { model: 'office', size: 'medium', mount: 'arm' })!;
    expect(arm.at[1]).toBeGreaterThan(stand.at[1]);
    const curved = monitorScreen('desk', { model: 'curved', size: 'large', mount: 'stand' })!;
    expect(curved.bend).toBeGreaterThan(0);
    expect(curved.width).toBeGreaterThan(stand.width);
    const portrait = monitorScreen('desk', { model: 'portrait', size: 'large', mount: 'stand' })!;
    expect(portrait.height).toBeGreaterThan(portrait.width);
  });

  it('relit la clé d’un gabarit d’écran', () => {
    for (const choice of ALL)
      expect(parseMonitorKey(monitorKey('standing-desk', choice))).toEqual({
        kind: 'standing-desk',
        choice,
      });
    expect(parseMonitorKey('desk')).toBeNull();
  });
});
