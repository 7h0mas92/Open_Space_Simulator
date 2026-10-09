import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GameRenderer } from '../../render/GameRenderer';
import { useDecorThemes } from '../../save/decor';
import { useCharacterPacks } from '../../save/packs';
import { setThumbnailSource } from '../build/thumbnails';
import { onGameNotifications, useGame } from '../store/game';
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
        edgePan: settings.edgePan,
        zoomSpeed: settings.zoomSpeed,
        translate: (key) => translateRef.current(key as never) as string,
        onPick: (target) => {
          const game = useGame.getState();
          game.select(target && target.type !== 'cell' ? target : null);
        },
        onPlace: (cell) => void useGame.getState().placeAt(cell),
        onBuildCell: (cell, wall) => useGame.getState().setBuildCell(cell, wall),
        onFps: (fps) => useGame.getState().setFps(fps),
      });
    } catch {
      // WebGL indisponible : l'interface reste utilisable sans la scène.
      return;
    }
    rendererRef.current = renderer;
    setThumbnailSource((kind) => renderer.thumbnail(kind));
    (window as unknown as { __oss?: unknown }).__oss = { debug: () => renderer.debugInfo() };

    const unsubscribeGame = useGame.subscribe((state, previous) => {
      if (state.view && state.view !== previous.view) renderer.setView(state.view);
      if (state.selected !== previous.selected) renderer.select(state.selected);
      if (state.build !== previous.build) {
        const build = state.build;
        renderer.setBuildPreview(
          build
            ? {
                kind: build.kind,
                rotation: build.rotation,
                movingItemId: build.movingItemId ?? undefined,
                cell: build.cell ?? null,
                color: build.color,
              }
            : null,
        );
      }
    });
    // Confettis : levée de fonds réussie, nouvelle phase ou anniversaire.
    const unsubscribeNotifications = onGameNotifications((notifications) => {
      if (
        notifications.some(
          (n) => n.kind === 'FUNDS_RAISED' || n.kind === 'PHASE_UP' || n.kind === 'DEV_BIRTHDAY',
        )
      )
        renderer.celebrate();
    });
    const unsubscribeSettings = useSettings.subscribe((state) => {
      renderer.setQuality(state.quality);
      renderer.setReducedMotion(state.reducedMotion);
      renderer.setEdgePan(state.edgePan);
      renderer.setZoomSpeed(state.zoomSpeed);
    });
    // Costumes des packs de personnages activés au back-office (Noël, Halloween…).
    renderer.setCharacterPacks(useCharacterPacks.getState().enabled);
    const unsubscribePacks = useCharacterPacks.subscribe((state) =>
      renderer.setCharacterPacks(state.enabled),
    );
    void useCharacterPacks.getState().refresh();
    // Décorations de saison (Halloween, Noël…) réglées au back-office.
    renderer.setDecorModes(useDecorThemes.getState().modes);
    const unsubscribeDecor = useDecorThemes.subscribe((state) =>
      renderer.setDecorModes(state.modes),
    );
    void useDecorThemes.getState().refresh();
    const initial = useGame.getState();
    if (initial.view) renderer.setView(initial.view);

    return () => {
      unsubscribeGame();
      unsubscribeNotifications();
      unsubscribeSettings();
      unsubscribePacks();
      unsubscribeDecor();
      setThumbnailSource(null);
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
