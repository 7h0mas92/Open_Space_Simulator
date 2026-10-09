import { useEffect, useRef } from 'react';
import { MusicPlayer, musicMoodOf } from '../audio/music';
import { useGame } from './store/game';
import { useSettings } from './store/settings';

/**
 * Musique de toute l'application : du menu à l'écran de fin, elle suit l'étape du sprint
 * (lecture seule de la GameView) et le volume « Musique » des options.
 */
export function useMusic() {
  const mood = useGame((s) => musicMoodOf(s.view?.step ?? null));
  const volume = useSettings((s) => s.musicVolume);
  const player = useRef<MusicPlayer | null>(null);

  useEffect(() => {
    const music = new MusicPlayer(useSettings.getState().musicVolume);
    player.current = music;
    return () => {
      music.stop();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    player.current?.setMood(mood);
  }, [mood]);

  useEffect(() => {
    player.current?.setVolume(volume);
  }, [volume]);
}
