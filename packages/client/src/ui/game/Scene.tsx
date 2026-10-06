import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GameRenderer } from '../../render/GameRenderer';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';

/**
 * Hôte du canvas Three.js. Crée le moteur de rendu une fois, puis lui transmet chaque nouvel
 * instantané, la sélection et le mode construction. Le rendu ne touche jamais au store.
 */
export function Scene() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const translateRef = useRef(t);
  useEffect(() => {
    translateRef.current = t;
  }, [t]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    let renderer: GameRenderer;
    try {
      const settings = useSettings.getState();
      renderer = new GameRenderer({
        canvas,
        overlay,
        quality: settings.quality,
        reducedMotion: settings.reducedMotion,
        translate: (key) => translateRef.current(key as never) as string,
        onPick: (target) => {
          const game = useGame.getState();
          game.select(target && target.type !== 'cell' ? target : null);
        },
        onPlace: (cell) => {
          const { build, dispatch, setBuild } = useGame.getState();
          if (!build?.kind) return;
          if (build.movingItemId) {
            const result = dispatch({
              type: 'moveItem',
              itemId: build.movingItemId,
              x: cell.x,
              z: cell.z,
            });
            if (result.ok) setBuild(null);
          } else {
            dispatch({
              type: 'placeItem',
              kind: build.kind,
              x: cell.x,
              z: cell.z,
              rotation: build.rotation,
            });
          }
        },
        onFps: (fps) => useGame.getState().setFps(fps),
      });
    } catch {
      // WebGL indisponible : l'interface reste utilisable sans la scène.
      return;
    }
    rendererRef.current = renderer;
    (window as unknown as { __oss?: unknown }).__oss = { debug: () => renderer.debugInfo() };

    const unsubscribeGame = useGame.subscribe((state, previous) => {
      if (state.view && state.view !== previous.view) renderer.setView(state.view);
      if (state.selected !== previous.selected) renderer.select(state.selected);
      if (state.build !== previous.build) {
        const build = state.build;
        renderer.setBuildPreview(
          build?.kind
            ? {
                kind: build.kind,
                rotation: build.rotation,
                movingItemId: build.movingItemId ?? undefined,
              }
            : null,
        );
      }
    });
    const unsubscribeSettings = useSettings.subscribe((state) => {
      renderer.setQuality(state.quality);
      renderer.setReducedMotion(state.reducedMotion);
    });
    const initial = useGame.getState();
    if (initial.view) renderer.setView(initial.view);

    return () => {
      unsubscribeGame();
      unsubscribeSettings();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div className="scene">
      <canvas
        ref={canvasRef}
        className="scene-canvas"
        tabIndex={0}
        aria-label={t('game.sceneLabel')}
        data-testid="scene"
      />
      <div ref={overlayRef} className="scene-overlay" />
    </div>
  );
}
