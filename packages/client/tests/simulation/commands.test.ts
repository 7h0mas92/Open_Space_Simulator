import { BALANCE, GameStateSchema, TEAM_MAX } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { acceptanceChance, makeOffer } from '../../src/simulation/devs';
import { monthlyExpenses } from '../../src/simulation/economy';
import { closePitch, maxRaise, pitchArgument, startPitch } from '../../src/simulation/fundraising';
import { canPlace, computeOfficeEffects } from '../../src/simulation/furniture';
import { teamSize } from '../../src/simulation/helpers';
import { createTask, tasksInColumn } from '../../src/simulation/tasks';
import { FixedRng, makeContext, newSimulation, stateWithTeam } from './fixtures';

describe('Kanban', () => {
  it('déplace les tâches entre BACKLOG et TODO et gère la priorité', () => {
    const simulation = newSimulation('kanban');
    const [a, b, c] = tasksInColumn(simulation.state, 'BACKLOG');
    expect(a && b && c).toBeTruthy();
    simulation.dispatch({ type: 'MOVE_TASK', taskId: a!, column: 'TODO' });
    simulation.dispatch({ type: 'MOVE_TASK', taskId: b!, column: 'TODO' });
    simulation.dispatch({ type: 'MOVE_TASK', taskId: c!, column: 'TODO', index: 0 });
    expect(tasksInColumn(simulation.state, 'TODO')).toEqual([c, a, b]);
    simulation.dispatch({ type: 'MOVE_TASK', taskId: a!, column: 'BACKLOG' });
    expect(tasksInColumn(simulation.state, 'TODO')).toEqual([c, b]);
    expect(
      simulation.dispatch({ type: 'MOVE_TASK', taskId: 'e999', column: 'TODO' }).result.ok,
    ).toBe(false);
  });

  it('affecte une tâche à un dev, une seule à la fois', () => {
    const simulation = newSimulation('assign');
    const state = simulation.state;
    const devId = Object.keys(state.components.identity)[0]!;
    const [a, b] = tasksInColumn(state, 'BACKLOG');
    expect(simulation.dispatch({ type: 'ASSIGN_TASK', taskId: a!, devId }).result.ok).toBe(true);
    expect(state.components.task[a!]?.column).toBe('TODO');
    expect(state.components.worker[devId]?.taskId).toBe(a);
    simulation.dispatch({ type: 'ASSIGN_TASK', taskId: b!, devId });
    expect(state.components.task[a!]?.assigneeId).toBeNull();
    expect(state.components.worker[devId]?.taskId).toBe(b);
    simulation.dispatch({ type: 'ASSIGN_TASK', taskId: b!, devId: null });
    expect(state.components.worker[devId]?.taskId).toBeNull();
    // Renvoyer une tâche affectée au backlog la libère.
    simulation.dispatch({ type: 'ASSIGN_TASK', taskId: a!, devId });
    simulation.dispatch({ type: 'MOVE_TASK', taskId: a!, column: 'BACKLOG' });
    expect(state.components.worker[devId]?.taskId).toBeNull();
    expect(simulation.dispatch({ type: 'ASSIGN_TASK', taskId: a!, devId: 'e999' }).result.ok).toBe(
      false,
    );
  });

  it('les devs sans tâche prennent la suivante pendant le sprint', () => {
    const simulation = newSimulation('auto');
    const [a] = tasksInColumn(simulation.state, 'BACKLOG');
    simulation.dispatch({ type: 'MOVE_TASK', taskId: a!, column: 'TODO' });
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.runUntilBlocked(6);
    const task = simulation.state.components.task[a!];
    expect(task?.assigneeId ?? task?.column).toBeTruthy();
    expect(['IN_PROGRESS', 'DONE']).toContain(task?.column);
  });
});

describe('Recrutement', () => {
  it('la probabilité d’accepter dépend de l’offre et de l’ego', () => {
    const simulation = newSimulation('offer');
    const candidate = simulation.state.candidates[0]!;
    expect(acceptanceChance(candidate, candidate.askingSalary * 0.5)).toBe(0);
    expect(acceptanceChance(candidate, candidate.askingSalary * 2)).toBe(1);
    const middle = acceptanceChance(candidate, candidate.askingSalary * 0.95);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
  });

  it('embauche ou perd le candidat selon la négociation', () => {
    const simulation = newSimulation('hire');
    const [first, second] = simulation.state.candidates;
    simulation.dispatch({
      type: 'MAKE_OFFER',
      candidateId: first!.id,
      salary: first!.askingSalary * 1.5,
    });
    expect(first!.status).toBe('HIRED');
    expect(teamSize(simulation.state)).toBe(2);
    // Garage : 2 personnes maximum.
    const full = simulation.dispatch({
      type: 'MAKE_OFFER',
      candidateId: second!.id,
      salary: 99_999,
    });
    expect(full.result).toEqual({ ok: false, error: 'TEAM_FULL' });
    expect(TEAM_MAX.GARAGE).toBe(2);

    const { state } = stateWithTeam([]);
    state.candidates = [{ ...second!, status: 'OPEN' }];
    const ctx = makeContext(state, { rng: new FixedRng(0.999) });
    expect(makeOffer(state, ctx, second!.id, second!.askingSalary).ok).toBe(true);
    expect(state.candidates[0]?.status).toBe('REFUSED');
    expect(ctx.outbox.some((n) => n.kind === 'OFFER_REFUSED')).toBe(true);
    expect(makeOffer(state, ctx, 'inconnu', 1000)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('licencier coûte des indemnités et du moral', () => {
    const simulation = newSimulation('fire');
    const candidate = simulation.state.candidates[0]!;
    simulation.dispatch({
      type: 'MAKE_OFFER',
      candidateId: candidate.id,
      salary: candidate.askingSalary * 2,
    });
    const [keep, fire] = Object.keys(simulation.state.components.identity);
    const moralBefore = simulation.state.components.mood[keep!]!.moral;
    const cashBefore = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'FIRE_DEV', devId: fire! }).result.ok).toBe(true);
    expect(simulation.state.components.identity[fire!]).toBeUndefined();
    expect(simulation.state.components.relations[keep!]?.[fire!]).toBeUndefined();
    expect(simulation.state.components.mood[keep!]!.moral).toBeLessThan(moralBefore);
    expect(simulation.state.gauges.treasury).toBeLessThan(cashBefore);
    expect(simulation.state.stats.fired).toBe(1);
    expect(simulation.dispatch({ type: 'FIRE_DEV', devId: fire! }).result.ok).toBe(false);
  });
});

describe('Aménagement', () => {
  it('achète, déplace, tourne et revend des objets sur la grille', () => {
    const simulation = newSimulation('build');
    const cash = simulation.state.gauges.treasury;
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'plant', x: 5, y: 3, rotation: 0 })
        .result.ok,
    ).toBe(true);
    expect(simulation.state.gauges.treasury).toBe(cash - 60);
    const plantId = Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'plant',
    )![0];
    // Collision avec la plante, hors de la grille, objet verrouillé, objet inconnu.
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'plant', x: 5, y: 3, rotation: 0 })
        .result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'desk', x: 7, y: 0, rotation: 0 }).result
        .ok,
    ).toBe(false);
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'babyfoot', x: 4, y: 4, rotation: 0 })
        .result,
    ).toEqual({ ok: false, error: 'LOCKED' });
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'licorne', x: 0, y: 0, rotation: 0 })
        .result,
    ).toEqual({ ok: false, error: 'NOT_FOUND' });

    expect(
      simulation.dispatch({ type: 'MOVE_FURNITURE', furnitureId: plantId, x: 4, y: 5, rotation: 1 })
        .result.ok,
    ).toBe(true);
    expect(simulation.state.components.furniture[plantId]).toMatchObject({
      x: 4,
      y: 5,
      rotation: 1,
    });
    expect(
      simulation.dispatch({
        type: 'MOVE_FURNITURE',
        furnitureId: plantId,
        x: 40,
        y: 5,
        rotation: 1,
      }).result.ok,
    ).toBe(false);
    expect(simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: plantId }).result.ok).toBe(
      true,
    );
    expect(simulation.state.gauges.treasury).toBe(cash - 60 + 30);
    expect(simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: plantId }).result.ok).toBe(
      false,
    );
  });

  it('refuse un objet trop cher ou en trop grand nombre', () => {
    const simulation = newSimulation('limits');
    simulation.state.gauges.treasury = 10;
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'plant', x: 5, y: 3, rotation: 0 })
        .result,
    ).toEqual({ ok: false, error: 'NOT_ENOUGH_MONEY' });
    simulation.state.gauges.treasury = 1_000_000;
    simulation.dispatch({
      type: 'BUY_FURNITURE',
      itemId: 'coffee-machine',
      x: 6,
      y: 0,
      rotation: 0,
    });
    simulation.dispatch({
      type: 'BUY_FURNITURE',
      itemId: 'coffee-machine',
      x: 5,
      y: 0,
      rotation: 0,
    });
    expect(
      simulation.dispatch({
        type: 'BUY_FURNITURE',
        itemId: 'coffee-machine',
        x: 4,
        y: 0,
        rotation: 0,
      }).result,
    ).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });
  });

  it('tient compte de la rotation pour l’emprise au sol', () => {
    const { state } = stateWithTeam([]);
    state.phase = 'GARAGE';
    const desk = { id: 'desk', width: 2, depth: 1 } as Parameters<typeof canPlace>[1];
    expect(canPlace(state, desk, 7, 0, 0)).toBe(false);
    expect(canPlace(state, desk, 7, 0, 1)).toBe(true);
  });
});

describe('Accessoires et couleurs', () => {
  function deskOf(simulation: ReturnType<typeof newSimulation>): string {
    return Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'ikea-desk',
    )![0];
  }

  it('pose un accessoire sur un emplacement libre d’un meuble à plateau', () => {
    const simulation = newSimulation('accessory');
    const hostId = deskOf(simulation);
    const cash = simulation.state.gauges.treasury;
    const buy = (slot: number, host = hostId) =>
      simulation.dispatch({
        type: 'BUY_ACCESSORY',
        itemId: 'rubber-duck',
        hostId: host,
        slot,
        rotation: 0,
        color: 'pink',
      }).result;
    expect(buy(0)).toEqual({ ok: true });
    expect(simulation.state.gauges.treasury).toBe(cash - 10);
    const duck = Object.values(simulation.state.components.furniture).find(
      (f) => f.itemId === 'rubber-duck',
    );
    expect(duck).toMatchObject({ hostId, slot: 0, color: 'pink' });
    // Emplacement pris, emplacement inexistant, meuble sans plateau, accessoire au sol.
    expect(buy(0)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(buy(3)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    const plantId = Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'small-plant',
    )![0];
    expect(buy(0, plantId)).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(
      simulation.dispatch({ type: 'BUY_FURNITURE', itemId: 'rubber-duck', x: 5, y: 3, rotation: 0 })
        .result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    // Un meuble ne se pose pas sur un autre, un accessoire n'occupe pas le sol.
    expect(
      simulation.dispatch({
        type: 'BUY_ACCESSORY',
        itemId: 'plant',
        hostId,
        slot: 1,
        rotation: 0,
      }).result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(buy(1)).toEqual({ ok: true });
  });

  it('les accessoires suivent leur meuble, et partent avec lui à la revente', () => {
    const simulation = newSimulation('accessory-host');
    const hostId = deskOf(simulation);
    simulation.dispatch({
      type: 'BUY_ACCESSORY',
      itemId: 'desk-lamp',
      hostId,
      slot: 1,
      rotation: 0,
    });
    const [lampId, lamp] = Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'desk-lamp',
    )!;
    // Un accessoire ne se déplace pas comme un meuble, mais d'emplacement en emplacement.
    expect(
      simulation.dispatch({ type: 'MOVE_FURNITURE', furnitureId: lampId, x: 4, y: 4, rotation: 0 })
        .result.ok,
    ).toBe(false);
    expect(
      simulation.dispatch({
        type: 'MOVE_ACCESSORY',
        furnitureId: lampId,
        hostId,
        slot: 0,
        rotation: 2,
      }).result.ok,
    ).toBe(true);
    expect(lamp).toMatchObject({ slot: 0, rotation: 2 });
    expect(
      simulation.dispatch({ type: 'MOVE_FURNITURE', furnitureId: hostId, x: 4, y: 5, rotation: 0 })
        .result.ok,
    ).toBe(true);
    expect(lamp).toMatchObject({ x: 4, y: 5 });

    const cash = simulation.state.gauges.treasury;
    simulation.dispatch({ type: 'SELL_FURNITURE', furnitureId: hostId });
    expect(simulation.state.components.furniture[lampId]).toBeUndefined();
    expect(simulation.state.gauges.treasury).toBe(cash + 20);
  });

  it('repeint un objet posé sans rien payer', () => {
    const simulation = newSimulation('paint');
    const hostId = deskOf(simulation);
    const cash = simulation.state.gauges.treasury;
    const paint = (color: 'blue' | 'natural') =>
      simulation.dispatch({ type: 'PAINT_FURNITURE', furnitureId: hostId, color }).result;
    expect(paint('blue')).toEqual({ ok: true });
    expect(simulation.state.components.furniture[hostId]?.color).toBe('blue');
    expect(paint('natural')).toEqual({ ok: true });
    expect(simulation.state.components.furniture[hostId]?.color).toBeUndefined();
    expect(simulation.state.gauges.treasury).toBe(cash);
    expect(
      simulation.dispatch({ type: 'PAINT_FURNITURE', furnitureId: 'e999', color: 'red' }).result,
    ).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});

describe('Inventaire', () => {
  const find = (simulation: ReturnType<typeof newSimulation>, itemId: string) =>
    Object.entries(simulation.state.components.furniture).find(([, f]) => f.itemId === itemId);

  it('range un meuble avec ses accessoires, puis les ressort gratuitement', () => {
    const simulation = newSimulation('inventory');
    const [hostId] = find(simulation, 'ikea-desk')!;
    simulation.dispatch({
      type: 'BUY_ACCESSORY',
      itemId: 'mini-cactus',
      hostId,
      slot: 0,
      rotation: 0,
      color: 'pink',
    });
    const cash = simulation.state.gauges.treasury;
    const desks = computeOfficeEffects(simulation.state).desks;
    expect(simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: hostId }).result).toEqual({
      ok: true,
    });
    expect(simulation.state.components.furniture[hostId]).toBeUndefined();
    expect(find(simulation, 'mini-cactus')).toBeUndefined();
    expect(simulation.state.inventory).toEqual([
      { itemId: 'mini-cactus', purchasePrice: 12, color: 'pink' },
      { itemId: 'ikea-desk', purchasePrice: 0 },
    ]);
    // Ranger est gratuit, et un objet rangé ne donne plus d'effet.
    expect(simulation.state.gauges.treasury).toBe(cash);
    expect(computeOfficeEffects(simulation.state).desks).toBe(desks - 1);

    // Ressortir : au sol pour un meuble, sur un plateau pour un accessoire (couleur gardée).
    expect(
      simulation.dispatch({ type: 'PLACE_STORED', itemId: 'ikea-desk', x: 4, y: 5, rotation: 2 })
        .result,
    ).toEqual({ ok: true });
    const [newHost, desk] = Object.entries(simulation.state.components.furniture).find(
      ([, f]) => f.itemId === 'ikea-desk' && f.x === 4,
    )!;
    expect(desk).toMatchObject({ x: 4, y: 5, rotation: 2 });
    expect(
      simulation.dispatch({
        type: 'PLACE_STORED_ACCESSORY',
        itemId: 'mini-cactus',
        hostId: newHost,
        slot: 1,
        rotation: 0,
      }).result,
    ).toEqual({ ok: false, error: 'NOT_FOUND' }); // pas de mini-cactus naturel en stock
    expect(
      simulation.dispatch({
        type: 'PLACE_STORED_ACCESSORY',
        itemId: 'mini-cactus',
        color: 'pink',
        hostId: newHost,
        slot: 1,
        rotation: 0,
      }).result,
    ).toEqual({ ok: true });
    expect(find(simulation, 'mini-cactus')?.[1]).toMatchObject({
      hostId: newHost,
      slot: 1,
      color: 'pink',
      purchasePrice: 12,
    });
    expect(simulation.state.inventory).toEqual([]);
    expect(simulation.state.gauges.treasury).toBe(cash);
  });

  it('refuse une pose impossible sans rien sortir de l’inventaire', () => {
    const simulation = newSimulation('inventory-invalid');
    const [plantId, plant] = find(simulation, 'small-plant')!;
    simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: plantId });
    const [deskId, desk] = find(simulation, 'ikea-desk')!;
    // Sur un autre meuble, ou comme accessoire : refusé, l'objet reste rangé.
    expect(
      simulation.dispatch({
        type: 'PLACE_STORED',
        itemId: 'small-plant',
        x: desk.x,
        y: desk.y,
        rotation: 0,
      }).result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(
      simulation.dispatch({
        type: 'PLACE_STORED_ACCESSORY',
        itemId: 'small-plant',
        hostId: deskId,
        slot: 0,
        rotation: 0,
      }).result,
    ).toEqual({ ok: false, error: 'INVALID_PLACEMENT' });
    expect(simulation.state.inventory).toHaveLength(1);
    expect(
      simulation.dispatch({
        type: 'PLACE_STORED',
        itemId: 'small-plant',
        x: plant.x,
        y: plant.y,
        rotation: 0,
      }).result.ok,
    ).toBe(true);
    expect(simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: 'e999' }).result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('revend un objet rangé, qui compte toujours dans le maximum', () => {
    const simulation = newSimulation('inventory-sell');
    const [hostId] = find(simulation, 'ikea-desk')!;
    simulation.state.gauges.treasury = 100_000;
    const buyHeadset = () =>
      simulation.dispatch({
        type: 'BUY_ACCESSORY',
        itemId: 'desk-headset',
        hostId,
        slot: 0,
        rotation: 0,
      }).result;
    expect(buyHeadset()).toEqual({ ok: true });
    const [headsetId] = find(simulation, 'desk-headset')!;
    // Ranger un accessoire seul libère son emplacement.
    simulation.dispatch({ type: 'STORE_FURNITURE', furnitureId: headsetId });
    expect(simulation.state.inventory).toEqual([{ itemId: 'desk-headset', purchasePrice: 320 }]);
    for (let i = 1; i < 30; i++)
      simulation.state.inventory.push({ itemId: 'desk-headset', purchasePrice: 320 });
    expect(buyHeadset()).toEqual({ ok: false, error: 'NOT_ELIGIBLE' });

    const cash = simulation.state.gauges.treasury;
    expect(simulation.dispatch({ type: 'SELL_STORED', itemId: 'desk-headset' }).result).toEqual({
      ok: true,
    });
    expect(simulation.state.gauges.treasury).toBe(cash + 160);
    expect(simulation.state.inventory).toHaveLength(29);
    expect(buyHeadset()).toEqual({ ok: true });
    expect(simulation.dispatch({ type: 'SELL_STORED', itemId: 'sofa' }).result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('le casque antibruit posé sur un bureau protège un dev des réunions', () => {
    const simulation = newSimulation('desk-headset');
    const [hostId] = find(simulation, 'ikea-desk')!;
    const shielded = () =>
      Object.values(computeOfficeEffects(simulation.state).meetingShielded).filter(Boolean).length;
    expect(shielded()).toBe(0);
    simulation.dispatch({
      type: 'BUY_ACCESSORY',
      itemId: 'desk-headset',
      hostId,
      slot: 0,
      rotation: 0,
    });
    expect(shielded()).toBe(1);
    // Rangé dans l'inventaire, il ne protège plus personne.
    simulation.dispatch({
      type: 'STORE_FURNITURE',
      furnitureId: find(simulation, 'desk-headset')![0],
    });
    expect(shielded()).toBe(0);
  });

  it('les anciennes sauvegardes sans inventaire se chargent', () => {
    const simulation = newSimulation('inventory-old-save');
    const old = JSON.parse(JSON.stringify(simulation.state)) as Record<string, unknown>;
    delete old.inventory;
    expect(GameStateSchema.parse(old).inventory).toEqual([]);
  });
});

describe('Levée de fonds', () => {
  it('plafonne le chèque à quelques mois de dépenses, trésorerie comprise', () => {
    const { state } = stateWithTeam(['TEN_X', 'SENIOR_BEARD']);
    state.phase = 'SERIES_A';
    state.gauges.treasury = 0;
    const empty = maxRaise(state);
    expect(empty).toBeGreaterThan(monthlyExpenses(state) * 12);
    state.gauges.treasury = empty;
    // Déjà plein aux as : l'investisseur ne met plus que le minimum.
    expect(maxRaise(state)).toBeLessThan(empty / 2);
    expect(maxRaise(state)).toBeGreaterThan(0);
  });

  it('un chèque plafonné dilue quand même au moins le minimum', () => {
    const { state } = stateWithTeam(['TEN_X']);
    state.phase = 'SERIES_A';
    state.gauges.hype = 95;
    state.gauges.users = 5_000_000;
    state.gauges.treasury = 50_000_000;
    const cap = maxRaise(state);
    const ctx = makeContext(state, { rng: new FixedRng(0.01) });
    expect(startPitch(state, ctx).ok).toBe(true);
    while (state.pitch && !state.pitch.result) pitchArgument(state, ctx, state.pitch.options[0]!);
    const result = state.pitch!.result!;
    expect(result.success).toBe(true);
    expect(result.amount).toBe(cap);
    expect(result.dilution).toBeCloseTo(BALANCE.fundraising.minDilution, 5);
  });

  it('déroule le pitch en 3 manches et calcule la dilution', () => {
    const { state } = stateWithTeam(['TEN_X']);
    state.phase = 'GARAGE';
    state.gauges.hype = 90;
    state.gauges.users = 50_000;
    const ctx = makeContext(state, { rng: new FixedRng(0.01) });
    expect(startPitch(state, ctx).ok).toBe(true);
    expect(state.stage).toBe('PITCH');
    expect(startPitch(state, ctx)).toEqual({ ok: false, error: 'WRONG_STAGE' });
    expect(pitchArgument(state, ctx, 'pas-un-argument')).toEqual({
      ok: false,
      error: 'INVALID_CHOICE',
    });
    expect(state.pitch!.manches).toBe(3);
    for (let round = 0; round < 3; round++) {
      expect(pitchArgument(state, ctx, state.pitch!.options[0]!).ok).toBe(true);
    }
    const result = state.pitch!.result!;
    expect(result.success).toBe(true);
    expect(result.dilution).toBeGreaterThan(0.09);
    expect(result.dilution).toBeLessThan(0.31);
    expect(state.ownership).toBeCloseTo(1 - result.dilution, 5);
    expect(state.phase).toBe('SEED');
    expect(pitchArgument(state, ctx, 'users-curve')).toEqual({ ok: false, error: 'WRONG_STAGE' });
    expect(closePitch(state).ok).toBe(true);
    expect(state.stage).toBe('PLANNING');
    expect(closePitch(state).ok).toBe(false);
    // Cooldown de 3 sprints entre deux pitchs.
    expect(startPitch(state, ctx)).toEqual({ ok: false, error: 'COOLDOWN' });
  });

  it('échoue face à un investisseur pas convaincu, et sans hype on ne pitche pas', () => {
    const { state } = stateWithTeam(['INTERN']);
    state.gauges.hype = 0;
    const ctx = makeContext(state, { rng: new FixedRng(0.999) });
    expect(startPitch(state, ctx)).toEqual({ ok: false, error: 'NO_HYPE' });
    state.gauges.hype = 20;
    state.gauges.debt = 100;
    startPitch(state, ctx);
    while (state.pitch && !state.pitch.result) pitchArgument(state, ctx, state.pitch.options[0]!);
    expect(state.pitch?.result?.success).toBe(false);
    expect(ctx.outbox.some((n) => n.kind === 'PITCH_FAILED')).toBe(true);
  });

  it('passe de Seed à Série A à la deuxième levée', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    state.phase = 'SEED';
    state.gauges.hype = 80;
    const ctx = makeContext(state, { rng: new FixedRng(0.01) });
    startPitch(state, ctx);
    while (state.pitch && !state.pitch.result) pitchArgument(state, ctx, state.pitch.options[0]!);
    expect(state.phase).toBe('SERIES_A');
  });
});

describe('Fins de partie', () => {
  it('accepte une offre de rachat', () => {
    const simulation = newSimulation('buyout');
    simulation.state.acquisitionOffer = {
      buyer: { fr: 'Gougle', en: 'Gougle' },
      amount: 50_000_000,
      expiresAtSprint: 2,
    };
    expect(simulation.dispatch({ type: 'ANSWER_ACQUISITION', accept: true }).result.ok).toBe(true);
    expect(simulation.state.result).toMatchObject({
      outcome: 'ACQUISITION',
      valuation: 50_000_000,
      phaseReached: 'GARAGE',
    });
    expect(simulation.state.result?.headline.fr).toContain('Gougle');
    expect(simulation.dispatch({ type: 'START_SPRINT' }).result).toEqual({
      ok: false,
      error: 'GAME_OVER',
    });
  });

  it('refuse une offre, ou répond à une offre inexistante', () => {
    const simulation = newSimulation('decline');
    expect(simulation.dispatch({ type: 'ANSWER_ACQUISITION', accept: true }).result.ok).toBe(false);
    simulation.state.acquisitionOffer = {
      buyer: { fr: 'X', en: 'X' },
      amount: 1,
      expiresAtSprint: 2,
    };
    simulation.dispatch({ type: 'ANSWER_ACQUISITION', accept: false });
    expect(simulation.state.acquisitionOffer).toBeNull();
    expect(simulation.state.stage).toBe('PLANNING');
  });

  it("n'autorise l'IPO qu'en Licorne avec une prod stable", () => {
    const simulation = newSimulation('ipo');
    expect(simulation.dispatch({ type: 'LAUNCH_IPO' }).result).toEqual({
      ok: false,
      error: 'NOT_ELIGIBLE',
    });
    simulation.state.phase = 'UNICORN';
    simulation.state.gauges.stability = 80;
    simulation.state.valuation = 2_000_000_000;
    expect(simulation.dispatch({ type: 'LAUNCH_IPO' }).result.ok).toBe(true);
    expect(simulation.state.result).toMatchObject({
      outcome: 'IPO',
      valuation: 2_400_000_000,
      phaseReached: 'UNICORN',
    });
  });

  it('fait faillite quand la trésorerie passe sous zéro', () => {
    const simulation = newSimulation('bankrupt');
    simulation.state.gauges.treasury = 100;
    simulation.dispatch({ type: 'START_SPRINT' });
    simulation.runUntilBlocked();
    if (simulation.state.events.pending) {
      simulation.dispatch({ type: 'RESOLVE_EVENT', choiceIndex: 0 });
      simulation.runUntilBlocked();
    }
    expect(simulation.state.result?.outcome).toBe('BANKRUPTCY');
    expect(simulation.state.result?.valuation).toBe(0);
  });

  it('crée bien des tâches de chaque type', () => {
    const { state } = stateWithTeam([]);
    const ctx = makeContext(state);
    for (const type of ['FEATURE', 'REFACTO', 'BUGFIX', 'INFRA'] as const) {
      const id = createTask(state, ctx.rng, type);
      expect(state.components.task[id]?.type).toBe(type);
    }
  });
});
