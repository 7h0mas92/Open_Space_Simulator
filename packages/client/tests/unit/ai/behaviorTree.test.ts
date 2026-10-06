import { describe, expect, it } from 'vitest';
import { action, condition, selector, sequence, type Status } from '../../../src/ai/behaviorTree';

interface Ctx {
  log: string[];
  hungry: boolean;
}

const log = (name: string, status: Status) =>
  action<Ctx>(name, (ctx) => {
    ctx.log.push(name);
    return status;
  });

describe('behavior trees', () => {
  it('sequence s’arrête au premier échec', () => {
    const ctx: Ctx = { log: [], hungry: false };
    expect(
      sequence('s', log('a', 'success'), log('b', 'failure'), log('c', 'success')).tick(ctx),
    ).toBe('failure');
    expect(ctx.log).toEqual(['a', 'b']);
  });

  it('selector s’arrête au premier succès ou running', () => {
    const ctx: Ctx = { log: [], hungry: false };
    expect(
      selector('s', log('a', 'failure'), log('b', 'running'), log('c', 'success')).tick(ctx),
    ).toBe('running');
    expect(ctx.log).toEqual(['a', 'b']);
    expect(selector<Ctx>('vide').tick(ctx)).toBe('failure');
    expect(sequence<Ctx>('vide').tick(ctx)).toBe('success');
  });

  it('condition aiguille le comportement', () => {
    const tree = selector<Ctx>(
      'root',
      sequence(
        'eat',
        condition('hungry', (c) => c.hungry),
        log('eat', 'success'),
      ),
      log('work', 'running'),
    );
    const ctx: Ctx = { log: [], hungry: true };
    tree.tick(ctx);
    ctx.hungry = false;
    tree.tick(ctx);
    expect(ctx.log).toEqual(['eat', 'work']);
  });
});
