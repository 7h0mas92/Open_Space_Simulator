import { describe, expect, it } from 'vitest';
import { CAT_POSES, CatWorld, itemPoint, type CatSnapshot } from '../../../src/ai/cats';
import { buildNavGrid } from '../../../src/ai/grid';
import { buildCat, poseCat } from '../../../src/render/pets';
import { layoutOf } from '../../../src/view/layout';
import { PET_COATS } from '../../../src/view/petCoats';
import type { GameView } from '../../../src/view/types';
import { officeSimulation, viewOf } from '../fixtures/game';

/** Bureau de la Seed avec tout l'équipement des chats et trois chats. */
function catOffice(minute = 10 * 60): GameView {
  const simulation = officeSimulation({
    phase: 'SEED',
    furniture: [
      { kind: 'desk', x: 4, z: 1 },
      { kind: 'litter-covered', x: 10, z: 5 },
      { kind: 'cat-feeder', x: 12, z: 5 },
      { kind: 'cat-tree-large', x: 7, z: 6, rotation: 1 },
      { kind: 'sofa', x: 1, z: 6 },
    ],
  });
  simulation.state.pets = [
    { id: 'cat-1', name: 'Segfault', coat: 'ginger', adoptedSprint: 1 },
    { id: 'cat-2', name: 'Pixel', coat: 'calico', adoptedSprint: 1 },
    { id: 'cat-3', name: 'Sudo', coat: 'siamese', adoptedSprint: 1 },
  ];
  const view = viewOf(simulation);
  return { ...view, time: { ...view.time, minute } };
}

function run(world: CatWorld, view: GameView, steps: number, each?: (s: CatSnapshot[]) => void) {
  world.sync(view);
  for (let i = 0; i < steps; i++) {
    world.step();
    each?.(world.snapshot());
  }
  return world.snapshot();
}

describe('IA des chats', () => {
  const view = catOffice();

  it('est déterministe : même graine, mêmes positions', () => {
    expect(run(new CatWorld(3), view, 600)).toEqual(run(new CatWorld(3), view, 600));
  });

  it('un chat par chat adopté, et il disparaît quand il part', () => {
    const world = new CatWorld(1);
    expect(run(world, view, 5)).toHaveLength(3);
    const fewer = { ...view, pets: { ...view.pets, pets: view.pets.pets.slice(0, 1) } };
    expect(run(world, fewer, 5).map((cat) => cat.id)).toEqual(['cat-1']);
  });

  it('marche sur des cases libres et ne quitte le sol que pour un meuble', () => {
    const grid = buildNavGrid(layoutOf(view), view.items);
    const heights = new Set<number>();
    run(new CatWorld(5), view, 3000, (cats) => {
      for (const cat of cats) {
        if (cat.y > 0) {
          heights.add(Math.round(cat.y * 100));
          continue;
        }
        // Au sol (hors litière, bol et pompon), toujours sur une case praticable.
        if (cat.pose === 'walk' || !cat.visible) continue;
        if (cat.activity === 'eat' || cat.activity === 'drink' || cat.activity === 'play') continue;
        expect(grid.walkable(Math.round(cat.x), Math.round(cat.z)) || cat.y > 0).toBe(true);
      }
    });
    // Les chats grimpent dans l'arbre à chat ou sur le canapé à un moment de la journée.
    expect(heights.size).toBeGreaterThan(0);
  });

  it('se cache dans la litière fermée, et la nuit dort surtout', () => {
    let hidden = 0;
    run(new CatWorld(9), view, 4000, (cats) => {
      hidden += cats.filter((cat) => !cat.visible).length;
    });
    expect(hidden).toBeGreaterThan(0);
    let sleeping = 0;
    let total = 0;
    run(new CatWorld(9), catOffice(2 * 60), 4000, (cats) => {
      total += cats.length;
      sleeping += cats.filter((cat) => cat.pose === 'sleep').length;
    });
    expect(sleeping / total).toBeGreaterThan(0.25);
  });

  it('deux chats ne se posent jamais au même endroit', () => {
    // Cinq chats pour une seule gamelle et une seule litière : ils doivent attendre leur tour.
    const crowded = {
      ...view,
      pets: {
        ...view.pets,
        pets: [
          ...view.pets.pets,
          { id: 'cat-4', name: 'Null', coat: 'black' as const, adoptedSprint: 1 },
          { id: 'cat-5', name: 'Bug', coat: 'white' as const, adoptedSprint: 1 },
        ],
      },
    };
    for (const [seed, office] of [
      [2, crowded],
      [7, crowded],
      [4, { ...crowded, time: { ...crowded.time, minute: 2 * 60 } }],
    ] as const) {
      let resting = 0;
      run(new CatWorld(seed), office, 4000, (cats) => {
        const places = cats
          .filter((cat) => cat.pose !== 'walk')
          .map((cat) => `${cat.x.toFixed(2)}:${cat.y.toFixed(2)}:${cat.z.toFixed(2)}`);
        resting += places.length;
        expect(new Set(places).size).toBe(places.length);
      });
      expect(resting).toBeGreaterThan(0);
    }
  });

  it('vit comme un chat : il mange, boit, va à la litière, joue et se repose', () => {
    const done = new Map<string, Set<string>>();
    const playSpots = new Set<string>();
    let afterMeal = 0;
    let drinksAfterMeal = 0;
    const last = new Map<string, string>();
    run(new CatWorld(11), view, 12_000, (cats) => {
      for (const cat of cats) {
        if (cat.pose === 'walk') continue;
        const set = done.get(cat.id) ?? new Set<string>();
        set.add(cat.activity);
        done.set(cat.id, set);
        if (cat.pose === 'play') playSpots.add(`${cat.id}:${cat.x.toFixed(2)}:${cat.z.toFixed(2)}`);
        // Ce qu'il fait juste après avoir mangé.
        const before = last.get(cat.id);
        if (before !== cat.activity) {
          if (before === 'eat') {
            afterMeal++;
            if (cat.activity === 'drink') drinksAfterMeal++;
          }
          last.set(cat.id, cat.activity);
        }
      }
    });
    for (const [, activities] of done)
      for (const need of ['eat', 'drink', 'litter', 'play'])
        expect(activities.has(need), need).toBe(true);
    for (const [, activities] of done)
      expect(activities.has('perch') || activities.has('nap') || activities.has('desk')).toBe(true);
    // En jouant, il saute d'une place à l'autre de l'arbre à chat.
    expect(playSpots.size).toBeGreaterThan(done.size);
    // Les croquettes donnent soif : il boit souvent juste après.
    expect(afterMeal).toBeGreaterThan(0);
    expect(drinksAfterMeal / afterMeal).toBeGreaterThan(0.3);
  });

  it('se tient devant le bol, la tête vers la gamelle', () => {
    const cats: CatSnapshot[] = [];
    run(new CatWorld(11), view, 6000, (snapshot) =>
      cats.push(...snapshot.filter((cat) => cat.pose === 'eat' || cat.pose === 'drink')),
    );
    expect(cats.length).toBeGreaterThan(0);
    // Le distributeur est posé en (12, 5) sans rotation : le chat est devant (z ≈ 5,46) et
    // regarde vers lui (orientation π, vers -z).
    for (const cat of cats) {
      expect(cat.z).toBeCloseTo(5.46);
      expect(Math.abs(Math.abs(cat.facing) - Math.PI)).toBeLessThan(1e-6);
    }
  });

  it('place les perchoirs dans le repère tourné du meuble', () => {
    const item = { kind: 'cat-tree-large', x: 7, z: 6, rotation: 1 as const };
    // Tourné d'un quart de tour, l'arbre de 3 x 1 occupe 1 x 3 cases : son centre est (7, 7).
    expect(itemPoint(item, [0, 1, 0])).toEqual({ x: 7, y: 1, z: 7 });
    const left = itemPoint(item, [-1, 0.8, 0]);
    expect(left.x).toBeCloseTo(7);
    expect(left.z).toBeCloseTo(8);
  });
});

describe('Modèle 3D des chats', () => {
  it('chaque robe se construit et prend toutes les postures', () => {
    for (const coat of PET_COATS) {
      const rig = buildCat(coat);
      expect(rig.legs).toHaveLength(4);
      for (const pose of CAT_POSES) {
        poseCat(rig, pose, 1.2, true);
        expect(rig.legs.every((leg) => leg.visible)).toBe(pose !== 'sleep');
      }
    }
  });
});
