import { describe, expect, it } from 'vitest';
import {
  CHARACTER_CLIPS,
  CHARACTER_IDS,
  characterUrl,
  FURNITURE_MODELS,
  furnitureUrl,
  MISSING_ASSETS,
} from '../../../src/render/assetManifest';
import { POSE_CLIPS } from '../../../src/render/characters';
import { WORKSTATION_ASSETS } from '../../../src/render/computers';
import { GestureRecognizer, LONG_PRESS_MS } from '../../../src/render/gestures';
import { interpolateAgent, lerpAngle } from '../../../src/render/interpolation';
import {
  azimuth,
  cameraDirection,
  clampTarget,
  clampZoom,
  scaleZoomFactor,
  wheelZoomFactor,
  fitZoom,
  frustum,
  MAX_ZOOM,
  MIN_ZOOM,
  panDelta,
} from '../../../src/render/isoCamera';
import { lightingAt, mixColor } from '../../../src/render/lighting';
import {
  defaultQuality,
  isSoftwareRenderer,
  MAX_PIXEL_RATIO,
  pixelRatioFor,
  QUALITY_PRESETS,
} from '../../../src/render/quality';
import { CATALOG, DESK_CHAIR, type ItemModel } from '../../../src/view/catalog';
import { AGENT_POSES, type AgentSnapshot } from '../../../src/ai/agents';

describe('qualité graphique', () => {
  it('plafonne le devicePixelRatio à 2 quel que soit l’écran', () => {
    expect(pixelRatioFor('high', 3)).toBe(MAX_PIXEL_RATIO);
    expect(pixelRatioFor('medium', 3)).toBe(1.5);
    expect(pixelRatioFor('low', 3)).toBe(1);
    expect(pixelRatioFor('high', 0)).toBe(1);
  });

  it('coupe les ombres en qualité basse (mobile)', () => {
    expect(QUALITY_PRESETS.low.shadows).toBe(false);
    expect(defaultQuality({ coarsePointer: true, screenWidth: 390 })).toBe('low');
    expect(defaultQuality({ coarsePointer: true, screenWidth: 820 })).toBe('medium');
    expect(
      defaultQuality({ coarsePointer: false, screenWidth: 1440, hardwareConcurrency: 2 }),
    ).toBe('medium');
    expect(defaultQuality({ coarsePointer: false, screenWidth: 1440 })).toBe('high');
    // Sans carte graphique, le processeur dessine chaque pixel : qualité basse.
    expect(
      defaultQuality({
        coarsePointer: false,
        screenWidth: 1440,
        gpuRenderer:
          'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      }),
    ).toBe('low');
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(isSoftwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)')).toBe(false);
    expect(isSoftwareRenderer(undefined)).toBe(false);
  });
});

describe('cycle jour/nuit', () => {
  it('fait plus clair à midi qu’à minuit, et allume les lampes le soir', () => {
    expect(lightingAt(12 * 60).sun).toBeGreaterThan(lightingAt(0).sun);
    expect(lightingAt(12 * 60).lampsOn).toBe(false);
    expect(lightingAt(20 * 60).lampsOn).toBe(true);
    expect(lightingAt(-60).sun).toBeCloseTo(lightingAt(23 * 60).sun);
  });

  it('mélange les couleurs composante par composante', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });
});

describe('caméra isométrique', () => {
  const state = { targetX: 5, targetZ: 5, zoom: 1, quarter: 0 };

  it('garde le pas de 12 % pour un cran de molette souris', () => {
    expect(wheelZoomFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false })).toBeCloseTo(1.12);
    expect(wheelZoomFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false })).toBeCloseTo(1 / 1.12);
    // Firefox : 3 lignes par cran.
    expect(wheelZoomFactor({ deltaY: -3, deltaMode: 1, ctrlKey: false })).toBeCloseTo(1.12);
    // Un gros delta ne dépasse pas un cran.
    expect(wheelZoomFactor({ deltaY: -1000, deltaMode: 0, ctrlKey: false })).toBeCloseTo(1.12);
  });

  it('zoome proportionnellement aux petits deltas du trackpad', () => {
    const tiny = wheelZoomFactor({ deltaY: -4, deltaMode: 0, ctrlKey: false });
    expect(tiny).toBeGreaterThan(1);
    expect(tiny).toBeLessThan(1.01);
    // 25 petits évènements valent un cran de souris, pas 25 crans.
    expect(tiny ** 25).toBeCloseTo(1.12);
    // Pincement trackpad (ctrlKey) : plus réactif mais toujours progressif.
    const pinch = wheelZoomFactor({ deltaY: -2, deltaMode: 0, ctrlKey: true });
    expect(pinch).toBeGreaterThan(1.01);
    expect(pinch).toBeLessThan(1.05);
  });

  it('applique la vitesse de zoom choisie', () => {
    const input = { deltaY: -100, deltaMode: 0, ctrlKey: false };
    const normal = Math.log(wheelZoomFactor(input));
    expect(Math.log(wheelZoomFactor(input, 'slow'))).toBeCloseTo(normal / 2);
    expect(Math.log(wheelZoomFactor(input, 'fast'))).toBeCloseTo(normal * 2);
    expect(scaleZoomFactor(1.5, 'normal')).toBeCloseTo(1.5);
    expect(scaleZoomFactor(4, 'slow')).toBeCloseTo(2);
  });

  it('borne le zoom', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
  });

  it('regarde le sol en diagonale, à 35° d’élévation', () => {
    const dir = cameraDirection(0);
    expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1);
    expect(dir.x).toBeCloseTo(dir.z);
    expect(Math.asin(dir.y)).toBeCloseTo((35.264 * Math.PI) / 180, 3);
    expect(azimuth(1) - azimuth(0)).toBeCloseTo(Math.PI / 2);
  });

  it('adapte le frustum au format de l’écran et au zoom', () => {
    expect(frustum(2, 1).halfWidth).toBeCloseTo(2 * frustum(2, 1).halfHeight);
    expect(frustum(1, 2).halfHeight).toBeCloseTo(frustum(1, 1).halfHeight / 2);
  });

  it('fait suivre le sol au doigt : glisser à droite déplace la cible vers la gauche de l’écran', () => {
    const right = panDelta(state, 100, 0, 800);
    // L'axe « droite » de l'écran au quart 0 est (cos45°, -sin45°) sur le sol.
    expect(right.dx).toBeLessThan(0);
    expect(right.dz).toBeGreaterThan(0);
    const none = panDelta(state, 0, 0, 800);
    expect(Math.abs(none.dx) + Math.abs(none.dz)).toBe(0);
    // Dézoomé, un même glissement couvre plus de sol.
    const far = panDelta({ ...state, zoom: 0.5 }, 100, 0, 800);
    expect(Math.abs(far.dx)).toBeCloseTo(Math.abs(right.dx) * 2);
  });

  it('garde la cible au-dessus du bureau', () => {
    expect(clampTarget({ ...state, targetX: -50, targetZ: 99 }, 10, 8)).toMatchObject({
      targetX: -2,
      targetZ: 9,
    });
  });

  it('cadre un bureau plus grand avec un zoom plus faible', () => {
    expect(fitZoom(28, 20, 16 / 9)).toBeLessThan(fitZoom(8, 6, 16 / 9));
    expect(fitZoom(8, 6, 16 / 9)).toBeLessThanOrEqual(MAX_ZOOM);
  });
});

describe('gestes souris et tactiles', () => {
  const at = (id: number, x: number, y: number, time = 0, touch = true) => ({
    id,
    x,
    y,
    time,
    touch,
  });

  it('un appui bref est un tap', () => {
    const g = new GestureRecognizer();
    g.down(at(1, 10, 10));
    expect(g.up(at(1, 12, 11, 100))).toEqual([{ type: 'tap', x: 12, y: 11 }]);
  });

  it('glisser déplace la caméra et n’est pas un tap', () => {
    const g = new GestureRecognizer();
    g.down(at(1, 0, 0));
    expect(g.move(at(1, 20, 0))).toEqual([{ type: 'pan', dx: 20, dy: 0 }]);
    expect(g.up(at(1, 20, 0))).toEqual([]);
  });

  it('pincer zoome', () => {
    const g = new GestureRecognizer();
    g.down(at(1, 0, 0));
    g.down(at(2, 100, 0));
    const events = g.move(at(2, 200, 0));
    expect(events[0]).toMatchObject({ type: 'pinch', scale: 2 });
    g.up(at(2, 200, 0));
    expect(g.up(at(1, 0, 0))).toEqual([]);
  });

  it('un appui long sélectionne (tactile uniquement)', () => {
    const g = new GestureRecognizer();
    g.down(at(1, 5, 5, 0));
    expect(g.poll(LONG_PRESS_MS - 1)).toEqual([]);
    expect(g.poll(LONG_PRESS_MS + 1)).toEqual([{ type: 'longPress', x: 5, y: 5 }]);
    expect(g.poll(LONG_PRESS_MS + 50)).toEqual([]);
    expect(g.up(at(1, 5, 5, 600))).toEqual([]);

    const mouse = new GestureRecognizer();
    mouse.down(at(1, 5, 5, 0, false));
    expect(mouse.poll(1000)).toEqual([]);
  });

  it('en mode construction, glisser déplace l’aperçu puis dépose', () => {
    const g = new GestureRecognizer();
    g.panLocked = true;
    g.down(at(1, 0, 0));
    expect(g.move(at(1, 30, 0))).toEqual([{ type: 'hover', x: 30, y: 0 }]);
    expect(g.up(at(1, 30, 0))).toEqual([{ type: 'drop', x: 30, y: 0 }]);
  });

  it('survol sans appui', () => {
    expect(new GestureRecognizer().move(at(9, 1, 2))).toEqual([{ type: 'hover', x: 1, y: 2 }]);
  });
});

describe('interpolation entre deux ticks', () => {
  const agent: AgentSnapshot = {
    id: 'a',
    x: 0,
    z: 0,
    facing: 0,
    pose: 'walk',
    visible: true,
    thought: null,
    using: null,
  };

  it('interpole la position', () => {
    const next = { ...agent, x: 1, z: 2 };
    expect(interpolateAgent(agent, next, 0.5)).toMatchObject({ x: 0.5, z: 1 });
    expect(interpolateAgent(agent, next, 2)).toMatchObject({ x: 1, z: 2 });
  });

  it('téléporte un personnage qui réapparaît', () => {
    const hidden = { ...agent, visible: false };
    const back = { ...agent, x: 9 };
    expect(interpolateAgent(hidden, back, 0.5).x).toBe(9);
    expect(interpolateAgent(undefined, back, 0.5).x).toBe(9);
  });

  it('tourne par le plus court chemin', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
  });
});

describe('manifeste des assets Kenney', () => {
  it('contient les 140 meubles et 18 personnages de l’inventaire', () => {
    expect(FURNITURE_MODELS).toHaveLength(140);
    expect(new Set(FURNITURE_MODELS).size).toBe(140);
    expect(characterUrl('a')).toBe(
      '/assets/kenney/kenney_blocky-characters_20/Models/GLB%20format/character-a.glb',
    );
    expect(furnitureUrl('desk')).toBe(
      '/assets/kenney/kenney_furniture-kit/Models/GLTF%20format/desk.glb',
    );
  });

  it('chaque objet du catalogue pointe vers un modèle existant ou un remplacement listé', () => {
    const missing = new Set<string>(MISSING_ASSETS.map((a) => a.id));
    const check = (model: ItemModel) => {
      if (model.source === 'kenney') expect(FURNITURE_MODELS).toContain(model.model);
      else expect(missing.has(model.model)).toBe(true);
    };
    for (const item of CATALOG) {
      check(item.model);
      for (const model of item.onTop ?? []) check(model);
      for (const part of item.parts ?? []) check(part.model);
    }
    expect(CATALOG.length).toBeGreaterThanOrEqual(15);
  });

  it('chaque objet du catalogue a un rendu qui lui est propre', () => {
    // Modèle principal, appareils posés dessus et pièces : deux objets ne se ressemblent jamais.
    const name = (model: ItemModel) => `${model.source}:${model.model}`;
    const looks = CATALOG.map((item) =>
      [
        name(item.model),
        ...(item.onTop ?? []).map(name),
        ...(item.parts ?? []).map((part) => name(part.model)),
      ].join('+'),
    );
    expect(new Set(looks).size).toBe(CATALOG.length);
    // Et chaque forme Three.js de remplacement sert au moins une fois.
    // La chaise des bureaux n'est pas au catalogue : `office.ts` la pose devant chaque bureau,
    // comme l'ordinateur de chaque poste de travail (clavier, tours, portable).
    const used = new Set([
      ...looks.join('+').split('+'),
      `primitive:${DESK_CHAIR.model}`,
      ...WORKSTATION_ASSETS.map((id) => `primitive:${id}`),
    ]);
    for (const asset of MISSING_ASSETS) {
      if (asset.replacement === 'primitive')
        expect(used, asset.id).toContain(`primitive:${asset.id}`);
    }
  });

  it('chaque fichier du manifeste est bien présent dans public/assets/kenney', () => {
    // Vite liste les fichiers sans les charger : on compare leurs URL à celles du manifeste.
    const urls = (paths: Record<string, unknown>) =>
      new Set(Object.keys(paths).map((path) => encodeURI(path.replace(/^\/public/, ''))));
    const models = urls(import.meta.glob('/public/assets/kenney/**/*.glb'));
    for (const model of FURNITURE_MODELS) expect(models).toContain(furnitureUrl(model));
    for (const id of CHARACTER_IDS) expect(models).toContain(characterUrl(id));
    expect(models.size).toBe(FURNITURE_MODELS.length + CHARACTER_IDS.length);
    // Les personnages chargent leur texture à côté du GLB.
    const textures = urls(import.meta.glob('/public/assets/kenney/**/Textures/*.png'));
    for (const id of CHARACTER_IDS)
      expect(textures).toContain(
        characterUrl(id).replace(/character-(\w)\.glb$/, 'Textures/texture-$1.png'),
      );
  });

  it('chaque posture a un clip qui existe dans les GLB', () => {
    for (const pose of AGENT_POSES) expect(CHARACTER_CLIPS).toContain(POSE_CLIPS[pose]);
  });
});
