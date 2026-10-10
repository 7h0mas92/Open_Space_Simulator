import { describe, expect, it, vi } from 'vitest';
import { createUpdatePolicy } from '../../src/ui/appUpdate';

/** Faux écran : en partie ou au menu, et les abonnés au retour au menu. */
function setup(inGame: boolean) {
  const state = { inGame, listeners: new Set<() => void>() };
  const apply = vi.fn();
  const onNeedRefresh = createUpdatePolicy({
    isInGame: () => state.inGame,
    onLeaveGame: (listener) => {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
    apply,
  });
  const leaveGame = () => {
    state.inGame = false;
    for (const listener of [...state.listeners]) listener();
  };
  return { state, apply, onNeedRefresh, leaveGame };
}

describe('mise à jour du jeu installé', () => {
  it('applique la nouvelle version tout de suite au menu', () => {
    const { apply, onNeedRefresh } = setup(false);
    onNeedRefresh();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('attend le retour au menu pendant une partie, une seule fois', () => {
    const { state, apply, onNeedRefresh, leaveGame } = setup(true);
    onNeedRefresh();
    onNeedRefresh();
    expect(apply).not.toHaveBeenCalled();
    expect(state.listeners.size).toBe(1);
    leaveGame();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(state.listeners.size).toBe(0);
  });
});
