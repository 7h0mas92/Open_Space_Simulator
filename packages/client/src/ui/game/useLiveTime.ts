import { useEffect, useState } from 'react';
import { liveTime, type LiveTime } from '../../view/liveTime';
import type { GameTime } from '../../view/types';

const MINUTES_PER_DAY = 24 * 60;

/**
 * Heure de jeu qui défile en continu (voir view/liveTime.ts). Le composant n'est re-rendu que
 * quand la minute affichée change ; à l'arrêt (pause, planification, carte), rien ne tourne.
 */
export function useLiveTime(time: GameTime): LiveTime {
  const { day, minute, tickMs, syncedAt } = time;
  const [total, setTotal] = useState(() => {
    const now = liveTime(time, performance.now());
    return now.day * MINUTES_PER_DAY + now.minute;
  });

  useEffect(() => {
    const read = (): number => {
      const now = liveTime({ day, minute, tickMs, syncedAt }, performance.now());
      return now.day * MINUTES_PER_DAY + now.minute;
    };
    setTotal(read());
    if (!Number.isFinite(tickMs)) return undefined;
    let handle = requestAnimationFrame(function tick() {
      setTotal(read());
      handle = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(handle);
  }, [day, minute, tickMs, syncedAt]);

  return { day: Math.floor(total / MINUTES_PER_DAY), minute: total % MINUTES_PER_DAY };
}
