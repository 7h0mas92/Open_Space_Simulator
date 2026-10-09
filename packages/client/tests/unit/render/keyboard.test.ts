import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  KEYBOARD_COLORS,
  KEYBOARD_SIZE,
  keyboardTexture,
  QWERTY_ROWS,
  qwertyKeyboard,
} from '../../../src/render/keyboard';

describe('clavier QWERTY', () => {
  it('aligne 15 unités par rangée, dans l’ordre QWERTY', () => {
    for (const row of QWERTY_ROWS) {
      expect(row.reduce((sum, key) => sum + key.width, 0)).toBeCloseTo(15);
    }
    const letters = QWERTY_ROWS.map((row) => row.map((key) => key.label).join(''));
    expect(letters[1]).toContain('QWERTYUIOP');
    expect(letters[2]).toContain('ASDFGHJKL');
    expect(letters[3]).toContain('ZXCVBNM');
  });

  it('dessine chaque touche, sa lettre et la touche Entrée en couleur', () => {
    const texture = keyboardTexture();
    const colors = new Set<number>();
    for (let y = 0; y < texture.height; y++)
      for (let x = 0; x < texture.width; x++) colors.add(texture.pixel(x, y));
    for (const color of Object.values(KEYBOARD_COLORS)) expect(colors).toContain(color);
  });

  it('tient en deux maillages, touches en relief au-dessus du boîtier', () => {
    const keyboard = qwertyKeyboard();
    const meshes: THREE.Mesh[] = [];
    keyboard.traverse((child) => {
      if (child instanceof THREE.Mesh) meshes.push(child);
    });
    expect(meshes).toHaveLength(2);
    const box = new THREE.Box3().setFromObject(keyboard);
    const size = box.getSize(new THREE.Vector3());
    expect(box.min.y).toBeCloseTo(0);
    expect(size.x).toBeCloseTo(KEYBOARD_SIZE.width);
    expect(size.z).toBeCloseTo(KEYBOARD_SIZE.depth);
    // Le boîtier fait 1,6 cm : les touches dépassent au-dessus.
    expect(size.y).toBeGreaterThan(0.025);
    const keys = meshes[1]!.geometry.getAttribute('position');
    expect(keys.count).toBe(QWERTY_ROWS.flat().length * 24);
  });
});
