import { TIME, type GameState } from '@oss/shared';
import { describe, expect, it } from 'vitest';
import { createGameEngine, InlineWorker } from '../../src/engine/bridge';
import { GameClock, isSpeed, MAX_TICKS_PER_FRAME, TICK_MS_AT_X1 } from '../../src/engine/clock';
import { SimulationHost } from '../../src/engine/host';
import { lerp, SnapshotBuffer } from '../../src/engine/interpolation';
import type { EngineSnapshot, WorkerToMain } from '../../src/engine/protocol';
import { defaultCardLibrary, DEFAULT_CARDS } from '../../src/events/defaultCards';
import {
  aggregate,
  dominatedChoices,
  playBalanceGame,
  renderReport,
} from '../../src/simulation/analysis';
import { tasksInColumn } from '../../src/simulation/tasks';
import { testCard } from './fixtures';

describe('Horloge réelle', () => {
  it('un sprint dure environ 3 minutes à x1', () => {
    expect(TICK_MS_AT_X1 * TIME.ticksPerSprint).toBeCloseTo(180_000, 3);
    expect(isSpeed(4)).toBe(true);
    expect(isSpeed(3)).toBe(false);
  });

  it('accumule le temps et joue 4 fois plus de ticks à x4', () => {
    const clock = new GameClock(100);
    expect(clock.advance(250)).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5);
    clock.speed = 4;
    expect(clock.advance(100)).toBe(4);
    expect(clock.tickDuration).toBe(25);
    expect(clock.advance(100_000)).toBe(MAX_TICKS_PER_FRAME);
    clock.speed = 0;
    expect(clock.advance(1000)).toBe(0);
    expect(clock.alpha).toBe(0);
    expect(clock.tickDuration).toBe(Number.POSITIVE_INFINITY);
    clock.speed = 1;
    clock.advance(50);
    clock.reset();
    expect(clock.alpha).toBe(0);
  });
});

describe('Hôte du worker', () => {
  function makeHost() {
    const messages: WorkerToMain[] = [];
    let now = 0;
    const host = new SimulationHost(
      (message) => messages.push(message),
      () => now,
      new GameClock(10),
    );
    const snapshots = () =>
      messages.filter(
        (m): m is Extract<WorkerToMain, { type: 'snapshot' }> => m.type === 'snapshot',
      );
    return { host, messages, snapshots, advance: (ms: number) => (now += ms) };
  }

  it('crée une partie, exécute les commandes et avance au rythme de l’horloge', () => {
    const { host, messages, snapshots, advance } = makeHost();
    host.handle({
      type: 'init',
      cards: DEFAULT_CARDS,
      game: { kind: 'new', seed: 'host', mode: 'NORMAL' },
    });
    expect(snapshots()).toHaveLength(1);
    expect(host.frame()).toBe(0);
    host.handle({ type: 'command', id: 1, command: { type: 'START_SPRINT' } });
    expect(messages).toContainEqual({ type: 'commandResult', id: 1, result: { ok: true } });
    advance(50);
    expect(host.frame()).toBe(5);
    expect(snapshots().at(-1)?.state.tick).toBe(5);
    host.handle({ type: 'setSpeed', speed: 0 });
    advance(50);
    expect(host.frame()).toBe(0);
    expect(snapshots().at(-1)?.running).toBe(false);
    host.handle({ type: 'setSpeed', speed: 7 as never });
    expect(snapshots().at(-1)?.speed).toBe(0);
  });

  it('sauvegarde une copie, puis recharge la partie', () => {
    const { host, messages } = makeHost();
    host.handle({
      type: 'init',
      cards: DEFAULT_CARDS,
      game: { kind: 'new', seed: 'save', mode: 'NORMAL' },
    });
    host.handle({ type: 'save', id: 7 });
    const save = messages.find((m) => m.type === 'save');
    expect(save?.type === 'save' && save.id).toBe(7);
    if (save?.type !== 'save') throw new Error('pas de sauvegarde');

    const reloaded = makeHost();
    reloaded.host.handle({
      type: 'init',
      cards: DEFAULT_CARDS,
      game: { kind: 'load', save: save.save },
    });
    // Même contenu (la validation Zod peut seulement réordonner les clés).
    expect(reloaded.snapshots()[0]?.state).toEqual(save.save.state);
  });

  it('refuse la pause en Hardcore et remonte les erreurs', () => {
    const { host, messages, snapshots } = makeHost();
    host.handle({ type: 'command', id: 1, command: { type: 'START_SPRINT' } });
    expect(messages[0]).toMatchObject({ type: 'error' });
    host.handle({
      type: 'init',
      cards: DEFAULT_CARDS,
      game: { kind: 'new', seed: 'hc', mode: 'HARDCORE' },
    });
    host.handle({ type: 'setSpeed', speed: 0 });
    expect(snapshots().at(-1)?.speed).toBe(1);
    host.handle({
      type: 'init',
      cards: [{ id: 'cassée' }] as never,
      game: { kind: 'new', seed: 'x', mode: 'NORMAL' },
    });
    expect(messages.at(-1)).toMatchObject({ type: 'error' });
  });
});

describe('Moteur côté thread principal', () => {
  it('démarre, envoie des commandes, sauvegarde et notifie les abonnés', async () => {
    let now = 0;
    const worker = new InlineWorker({ now: () => now, autoStart: false });
    const engine = createGameEngine(worker);
    expect(engine.snapshot).toBeNull();
    const received: EngineSnapshot[] = [];
    const unsubscribe = engine.subscribe((snapshot) => received.push(snapshot));
    const errors: string[] = [];
    engine.onError((message) => errors.push(message));

    const first = await engine.start(
      { kind: 'new', seed: 'bridge', mode: 'NORMAL' },
      DEFAULT_CARDS,
    );
    expect(first.state.sprint).toBe(1);
    const taskId = tasksInColumn(first.state, 'BACKLOG')[0]!;
    expect(await engine.dispatch({ type: 'MOVE_TASK', taskId, column: 'TODO' })).toEqual({
      ok: true,
    });
    expect(await engine.dispatch({ type: 'END_DEMO' })).toEqual({
      ok: false,
      error: 'WRONG_STAGE',
    });
    await engine.dispatch({ type: 'START_SPRINT' });
    engine.setSpeed(4);
    now += TICK_MS_AT_X1 * 2;
    expect(worker.frame()).toBe(8);
    expect(engine.snapshot?.state.tick).toBe(8);
    // Le snapshot est une copie : le modifier ne touche pas la simulation.
    (engine.snapshot!.state as GameState).gauges.treasury = 0;
    const save = await engine.save();
    expect(save.state.gauges.treasury).toBeGreaterThan(0);
    expect(save.commands).toHaveLength(2);

    expect(received.length).toBeGreaterThan(3);
    unsubscribe();
    worker.postMessage({ type: 'save', id: 99 });
    worker.onmessage?.({ data: { type: 'error', message: 'boom' } } as MessageEvent<WorkerToMain>);
    expect(errors).toEqual(['boom']);
    engine.dispose();
  });

  it('utilise un worker sur le thread principal quand Worker n’existe pas', async () => {
    const engine = createGameEngine();
    const snapshot = await engine.start({ kind: 'new', seed: 'fallback', mode: 'NORMAL' }, []);
    expect(snapshot.state.seed).toBe('fallback');
    engine.dispose();
  });
});

describe('Interpolation', () => {
  const snap = (tick: number, running = true, tickDurationMs = 100): EngineSnapshot => ({
    state: { tick } as GameState,
    notifications: [],
    speed: 1,
    running,
    tickDurationMs,
    replay: null,
  });

  it('calcule la progression entre deux ticks', () => {
    const buffer = new SnapshotBuffer();
    expect(buffer.alpha(0)).toBe(1);
    buffer.push(snap(1), 0);
    expect(buffer.latest?.state.tick).toBe(1);
    buffer.push(snap(2), 1000);
    expect(buffer.before?.state.tick).toBe(1);
    expect(buffer.alpha(1050)).toBe(0.5);
    expect(buffer.alpha(5000)).toBe(1);
    buffer.push(snap(2, false), 1060);
    expect(buffer.before?.state.tick).toBe(1);
    expect(buffer.alpha(1060)).toBe(1);
    buffer.push(snap(3, true, Number.POSITIVE_INFINITY), 2000);
    expect(buffer.alpha(2050)).toBe(1);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
});

describe('Analyse d’équilibrage', () => {
  it('repère les choix dominés', () => {
    const card = testCard({
      choices: [
        { label: { fr: 'A', en: 'A' }, effects: { hype: 5, debt: -5 } },
        { label: { fr: 'B', en: 'B' }, effects: { hype: 2 } },
        { label: { fr: 'C', en: 'C' }, effects: { treasury: 1000, debt: 10 } },
      ],
    });
    expect(dominatedChoices(card)).toEqual([1]);
    const dilemma = testCard({
      choices: [
        { label: { fr: 'A', en: 'A' }, effects: { hype: 5, debt: 5 } },
        { label: { fr: 'B', en: 'B' }, effects: { stability: 5 } },
      ],
    });
    expect(dominatedChoices(dilemma)).toEqual([]);
  });

  it('agrège des parties de bots et produit un rapport', () => {
    const cards = defaultCardLibrary();
    const records = ['a', 'b'].flatMap((seed) => [
      playBalanceGame(seed, 'random', cards),
      playBalanceGame(seed, 'cautious', cards),
    ]);
    const report = aggregate(records, cards);
    expect(report.games).toBe(4);
    expect(report.bots.map((b) => b.games)).toEqual([2, 2]);
    const markdown = renderReport(report);
    expect(markdown).toContain('#');
    expect(markdown.length).toBeGreaterThan(200);
  });
});
