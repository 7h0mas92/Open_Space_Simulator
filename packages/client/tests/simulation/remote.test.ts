import { BALANCE, GameStateSchema, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { placeFurniture } from '../../src/simulation/furniture';
import { activitySystem } from '../../src/simulation/systems/activity';
import { dailySystem } from '../../src/simulation/systems/daily';
import { coffeeSystem } from '../../src/simulation/systems/needs';
import { personalRemoteReason, remoteSystem } from '../../src/simulation/systems/remote';
import { productivity } from '../../src/simulation/systems/work';
import { assignTask, createTask } from '../../src/simulation/tasks';
import { clockAt } from '../../src/simulation/time';
import { toGameView } from '../../src/view/adapter';
import { makeContext, stateWithTeam } from './fixtures';

/** Horloge à un jour (0 = lundi) et une heure donnés du sprint 1. */
const at = (day: number, hour: number) => clockAt(1, (day * 24 + hour - 8) * 2);
const MORNING = at(1, BALANCE.remote.decisionHour);

function withDesks(state: GameState, count: number): void {
  for (let i = 0; i < count; i++) placeFurniture(state, 'desk', 1, 1 + i * 2, 0);
}

/** Lance la décision du matin et renvoie la raison de chaque dev. */
function morning(state: GameState) {
  const ctx = makeContext(state);
  remoteSystem(state, ctx, MORNING);
  return { ctx, reasons: { ...state.components.remoteReason } };
}

describe('Télétravail automatique', () => {
  it('les devs sans bureau libre restent chez eux, les derniers arrivés d’abord', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X', 'INTERN']);
    withDesks(state, 2);
    const { ctx, reasons } = morning(state);
    expect(reasons).toEqual({ [ids[2]!]: 'NO_DESK' });
    expect(state.components.remote).toEqual({ [ids[2]!]: true });
    expect(ctx.outbox.map((n) => n.kind)).toEqual(['DEV_REMOTE']);
    expect(state.stats.remoteDays).toBe(1);

    // Un bureau de plus : tout le monde revient.
    withDesks(state, 3);
    morning(state);
    expect(state.components.remote).toEqual({});
    expect(state.components.devLog[ids[2]!]?.at(-1)?.text.fr).toBe('De retour au bureau.');
  });

  it('le Dev Fantôme est toujours à distance, l’IA Agent jamais (et sans bureau)', () => {
    const { state, ids } = stateWithTeam(['GHOST', 'AI_AGENT']);
    const { ctx, reasons } = morning(state);
    expect(reasons).toEqual({ [ids[0]!]: 'GHOST' });
    // Le Fantôme ne déclenche pas d'annonce : il a toujours été en télétravail.
    expect(ctx.outbox).toEqual([]);
  });

  it('fatigue : le dev reste chez lui jusqu’à avoir récupéré (hystérésis)', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD']);
    withDesks(state, 1);
    const id = ids[0]!;
    const mood = state.components.mood[id]!;
    mood.energy = BALANCE.remote.fatigueEnergy - 1;
    expect(morning(state).reasons[id]).toBe('FATIGUE');
    mood.energy = BALANCE.remote.fatigueEnergy + 1;
    expect(morning(state).reasons[id]).toBe('FATIGUE');
    mood.energy = BALANCE.remote.fatigueRecovered;
    expect(morning(state).reasons[id]).toBeUndefined();
  });

  it('conflit et café vide font aussi rester à la maison', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    const [a, b] = [ids[0]!, ids[1]!];
    state.components.relations[a]![b] = BALANCE.remote.conflictAffinity - 1;
    state.components.relations[b]![a] = 0;
    state.components.identity[b]!.trait = 'COFFEE_ADDICT';
    state.gauges.coffee = 0;
    expect(personalRemoteReason(state, a)).toBe('CONFLICT');
    expect(personalRemoteReason(state, b)).toBe('NO_COFFEE');
    state.gauges.coffee = 50;
    expect(personalRemoteReason(state, b)).toBeNull();
  });

  it('rien ne change le week-end ni hors de l’heure de décision', () => {
    const { state } = stateWithTeam(['SENIOR_BEARD']);
    const ctx = makeContext(state);
    remoteSystem(state, ctx, at(5, BALANCE.remote.decisionHour));
    remoteSystem(state, ctx, at(1, 14));
    expect(state.components.remote).toEqual({});
  });

  it('effets : moins productif, pas de café ni de pause au bureau, moral au calme', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'TEN_X']);
    const id = ids[0]!;
    state.stage = 'EXECUTION';
    const ctx = makeContext(state);
    const task = state.components.task[createTask(state, ctx.rng, 'FEATURE')]!;
    const office = productivity(state, ctx, id, task);
    state.components.remote[id] = true;
    state.components.remoteReason[id] = 'FATIGUE';
    expect(productivity(state, ctx, id, task)).toBeCloseTo(
      office * (1 - BALANCE.remote.productivityPenalty),
      5,
    );
    // Café vide : seul le dev resté au bureau est ralenti.
    state.gauges.coffee = 0;
    expect(productivity(state, ctx, id, task)).toBeCloseTo(
      office * (1 - BALANCE.remote.productivityPenalty),
      5,
    );

    // Il ne consomme pas le café du bureau.
    state.gauges.coffee = 50;
    state.components.activity[ids[1]!]!.kind = 'IDLE';
    state.components.activity[id]!.kind = 'WORKING';
    const coffeeCtx = makeContext(state);
    coffeeSystem(state, coffeeCtx, at(1, 14));
    expect(state.gauges.coffee).toBe(50);

    // Au travail, il ne fait jamais de pause visible.
    const taskId = createTask(state, ctx.rng, 'FEATURE');
    assignTask(state, taskId, id);
    for (let i = 0; i < 50; i++) activitySystem(state, makeContext(state), at(1, 14));
    expect(state.components.activity[id]?.kind).toBe('WORKING');

    // Moral : le calme du télétravail compense une partie de la dette.
    state.gauges.debt = 30;
    const moodRemote = state.components.mood[id]!;
    const moodOffice = state.components.mood[ids[1]!]!;
    moodRemote.moral = 50;
    moodOffice.moral = 50;
    moodRemote.energy = moodOffice.energy = 80;
    state.components.identity[id]!.trait = 'ZEN';
    state.components.identity[ids[1]!]!.trait = 'ZEN';
    dailySystem(state, makeContext(state), at(1, 0));
    expect(moodRemote.moral).toBeGreaterThan(moodOffice.moral);
  });

  it('la vue indique qui télétravaille, pourquoi, et le nombre de bureaux', () => {
    const { state, ids } = stateWithTeam(['SENIOR_BEARD', 'GHOST']);
    withDesks(state, 0);
    morning(state);
    const view = toGameView(state, {
      speed: 1,
      running: false,
      card: () => undefined,
    });
    const [senior, ghost] = [ids[0]!, ids[1]!].map((id) => view.devs.find((d) => d.id === id)!);
    expect(senior?.remoteReason).toBe('NO_DESK');
    expect(senior?.activity).toBe('REMOTE');
    expect(ghost?.remoteReason).toBe('GHOST');
    expect(view.desks).toBe(0);
  });

  it('une sauvegarde d’avant le télétravail automatique reste chargeable', () => {
    const { state, ids } = stateWithTeam(['GHOST']);
    const old = JSON.parse(JSON.stringify(state)) as Record<string, Record<string, unknown>>;
    Reflect.deleteProperty(old.components!, 'remoteReason');
    Reflect.deleteProperty(old.stats!, 'remoteDays');
    const loaded = GameStateSchema.parse(old);
    expect(loaded.components.remoteReason).toEqual({});
    expect(loaded.stats.remoteDays).toBe(0);
    const view = toGameView(loaded, { speed: 1, running: false, card: () => undefined });
    expect(view.devs.find((d) => d.id === ids[0])?.remoteReason).toBe('GHOST');
  });
});
