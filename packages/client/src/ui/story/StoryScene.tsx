import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import {
  STORY_ACT_IDS,
  STORY_CHARACTERS,
  STORY_SCENES,
  actScene,
  type StorySceneId,
} from '@oss/shared';
import type { GameView } from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Scènes dialoguées de l'histoire en actes (`shared/story/scenes.ts`) : au lancement, au début
 * de chaque acte et à l'entrée en Bourse. Une réplique à la fois, « Suivant » (ou Entrée) pour
 * avancer, « Passer » pour fermer. Le temps s'arrête tant que la scène est ouverte, puis la
 * vitesse d'avant reprend. Interface seulement : la simulation ne voit jamais les scènes.
 */

interface SceneState {
  readonly scene: StorySceneId | null;
  /** Vitesse à reprendre à la fermeture (null : le temps était déjà arrêté). */
  readonly resumeSpeed: GameView['time']['speed'] | null;
}

export const useStoryScene = create<SceneState>(() => ({ scene: null, resumeSpeed: null }));

/** Ouvre une scène et arrête le temps (sauf en replay ou si le joueur l'a déjà arrêté). */
export function openScene(scene: StorySceneId): void {
  const game = useGame.getState();
  const speed = game.view?.time.speed ?? 0;
  const hold = speed !== 0 && game.replayOf === null;
  useStoryScene.setState({ scene, resumeSpeed: hold ? speed : null });
  if (hold) void game.dispatch({ type: 'setSpeed', speed: 0 });
}

function closeScene(): void {
  const { scene, resumeSpeed } = useStoryScene.getState();
  useStoryScene.setState({ scene: null, resumeSpeed: null });
  const game = useGame.getState();
  if (resumeSpeed !== null && game.view?.time.speed === 0)
    void game.dispatch({ type: 'setSpeed', speed: resumeSpeed });
  // Après la scène d'un acte, ses objectifs.
  if (scene && (STORY_ACT_IDS as readonly string[]).includes(scene)) game.openPanel('mission');
}

/**
 * Déclenche les scènes de la longue partie : le prologue au lancement, la scène de l'acte quand
 * il change, l'entrée en Bourse au début de la Saison libre. Pas en replay.
 */
export function useStoryScenes(): void {
  const replay = useGame((s) => s.replayOf !== null);
  const seed = useGame((s) => s.view?.seed);
  const opening = useGame((s) => s.view?.campaign != null && s.view.tick === 0);
  const act = useGame((s) => s.view?.campaign?.act ?? null);
  const free = useGame((s) => s.view?.campaign?.freeSeason ?? false);
  const lastAct = useRef(act);
  const lastFree = useRef(free);

  useEffect(() => {
    if (opening && !replay) openScene('prologue');
    // Une seule fois par partie lancée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    if (!replay && act !== null && lastAct.current !== null && act !== lastAct.current)
      openScene(actScene(act));
    lastAct.current = act;
  }, [act, replay]);

  useEffect(() => {
    if (!replay && free && !lastFree.current) openScene('ending-ipo');
    lastFree.current = free;
  }, [free, replay]);

  // Partie quittée pendant une scène : rien ne doit rester ouvert.
  useEffect(() => () => useStoryScene.setState({ scene: null, resumeSpeed: null }), []);
}

/** Répliques d'une scène, l'une après l'autre (aussi utilisé à l'écran de fin). */
export function SceneDialogue({
  scene,
  onDone,
  actions,
}: {
  scene: StorySceneId;
  onDone: () => void;
  /** Boutons de la dernière réplique, à la place de « Fermer ». */
  actions?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const lines = STORY_SCENES[scene];
  const [index, setIndex] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus(), [index]);
  const line = lines[index];
  if (!line) return null;
  const speaker = STORY_CHARACTERS[line.speaker];
  const last = index >= lines.length - 1;
  return (
    <div className="story-scene-dialogue" data-testid="story-scene">
      <p className="story-scene-speaker">
        <span className="story-scene-avatar" aria-hidden="true">
          {speaker.icon}
        </span>
        <strong>{localized(speaker.name, i18n.language)}</strong>
      </p>
      <p className="story-scene-line" aria-live="polite">
        {localized(line.text, i18n.language)}
      </p>
      <p className="story-scene-progress" aria-hidden="true">
        {lines.map((_, i) => (
          <span key={i} className={i <= index ? 'on' : ''} />
        ))}
      </p>
      <div className="stage-actions">
        {last ? (
          (actions ?? (
            <button
              ref={next}
              type="button"
              className="primary"
              onClick={onDone}
              data-testid="story-scene-close"
            >
              {t('story.scene.close')}
            </button>
          ))
        ) : (
          <>
            <button
              ref={next}
              type="button"
              className="primary"
              onClick={() => setIndex(index + 1)}
              data-testid="story-scene-next"
            >
              {t('story.scene.next')} ▸
            </button>
            <button type="button" onClick={onDone} data-testid="story-scene-skip">
              {t('story.scene.skip')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** La scène ouverte, par-dessus la partie. */
export function StoryScene() {
  const { t } = useTranslation();
  const scene = useStoryScene((s) => s.scene);
  const dispatch = useGame((s) => s.dispatch);
  useEffect(() => {
    if (!scene) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeScene();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene]);
  if (!scene) return null;
  const ipo = scene === 'ending-ipo';
  return (
    <div className="story-scene-backdrop">
      <section
        className="story-scene"
        role="dialog"
        aria-modal="true"
        aria-label={t(`story.scene.titles.${scene}`)}
      >
        <p className="eyebrow">{t(`story.scene.titles.${scene}`)}</p>
        <SceneDialogue
          key={scene}
          scene={scene}
          onDone={closeScene}
          actions={
            ipo ? (
              <>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    closeScene();
                    openScene('free-season');
                  }}
                  data-testid="story-free-season"
                >
                  {t('story.scene.freeSeason')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeScene();
                    void dispatch({ type: 'endStory' });
                  }}
                  data-testid="story-end-here"
                >
                  {t('story.scene.endHere')}
                </button>
              </>
            ) : undefined
          }
        />
      </section>
    </div>
  );
}

/** Toutes les répliques d'une scène d'un coup (écran de fin). */
export function SceneTranscript({ scene }: { scene: StorySceneId }) {
  const { i18n } = useTranslation();
  return (
    <ol className="story-scene-transcript">
      {STORY_SCENES[scene].map((line, index) => {
        const speaker = STORY_CHARACTERS[line.speaker];
        return (
          <li key={index}>
            <span aria-hidden="true">{speaker.icon} </span>
            <strong>
              {localized(speaker.name, i18n.language)}
              {i18n.language.startsWith('fr') ? ' : ' : ': '}
            </strong>
            {localized(line.text, i18n.language)}
          </li>
        );
      })}
    </ol>
  );
}
