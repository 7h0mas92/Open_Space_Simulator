import { useEffect, useRef } from 'react';
import { modeRules } from '@oss/shared';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import { TICKET_APP } from '../../view/ticketBoard';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';

/*
 * Le Daily du matin, à l'écran. La simulation avance par pas de 30 minutes : à x1, les
 * 20 minutes de réunion passent en une fraction de seconde. Pour qu'on voie l'équipe en salle
 * et l'appli de tickets projetée, le temps s'arrête quelques secondes au début du Daily (option
 * « Pause pendant le Daily », active par défaut), puis la vitesse d'avant reprend. Seule
 * l'horloge réelle s'arrête : la simulation, ses tirages et ses replays ne changent pas.
 * Pas de pause en Hardcore (pas de pause du tout), en replay, ni face à une carte.
 */

/** Durée de la pause du Daily, en millisecondes réelles. */
export const DAILY_HOLD_MS = 6000;

/** Vitesse à reprendre tant que la pause du Daily tient (null : pas de pause en cours). */
export const useDailyHold = create<{ speed: GameView['time']['speed'] | null }>(() => ({
  speed: null,
}));

export function DailyMoment({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const openPanel = useGame((s) => s.openPanel);
  const panel = useGame((s) => s.panel);
  const replay = useGame((s) => s.replayOf !== null);
  const dailyPause = useSettings((s) => s.dailyPause);
  const daily = view.meetingRoom.daily;
  const live = daily?.live === true && view.step === 'EXECUTION';
  /** Daily déjà mis en pause (on ne le refait pas à chaque snapshot). */
  const heldTick = useRef<number | null>(null);
  const held = useDailyHold((s) => s.speed);
  const hold = held === null ? null : { speed: held };

  useEffect(() => {
    if (!live || !daily || heldTick.current === daily.tick) return;
    heldTick.current = daily.tick;
    const speed = view.time.speed;
    if (!dailyPause || replay || !modeRules(view.mode).canPause || view.event || speed === 0)
      return;
    useDailyHold.setState({ speed });
    void dispatch({ type: 'setSpeed', speed: 0 });
  }, [live, daily, dailyPause, replay, view.mode, view.event, view.time.speed, dispatch]);

  const resume = () => {
    if (!hold) return;
    useDailyHold.setState({ speed: null });
    // Le joueur a pu relancer le temps lui-même entre-temps : on ne touche plus à rien.
    if (useGame.getState().view?.time.speed === 0)
      void dispatch({ type: 'setSpeed', speed: hold.speed });
  };

  // La pause se lève seule après quelques secondes, sauf si l'appli est ouverte en grand.
  const reading = panel === 'tickets';
  useEffect(() => {
    if (!hold || reading) return undefined;
    const timer = window.setTimeout(resume, DAILY_HOLD_MS);
    return () => window.clearTimeout(timer);
    // `resume` ne dépend que de `hold`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, reading]);

  // L'appli refermée pendant la pause : on reprend tout de suite.
  const wasReading = useRef(false);
  // Partie quittée pendant la pause : rien ne doit rester en attente.
  useEffect(() => () => useDailyHold.setState({ speed: null }), []);
  useEffect(() => {
    if (wasReading.current && !reading && hold) resume();
    wasReading.current = reading;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  if ((!live && !hold) || panel !== null) return null;
  return (
    <div className="daily-moment" role="status" data-testid="daily-moment">
      <span className="daily-moment-text">
        <span aria-hidden="true">📽️ </span>
        {t(daily?.useful ? 'daily.liveUseful' : 'daily.liveUseless', { focus: daily?.focus ?? 0 })}
      </span>
      <button type="button" className="primary" onClick={() => openPanel('tickets')}>
        {t('daily.open', { app: TICKET_APP.name })}
      </button>
      {hold && (
        <button type="button" onClick={resume}>
          {t('daily.resume')}
        </button>
      )}
    </div>
  );
}
