/**
 * Branche le Slack simulé et l'audio sur la partie en cours. Ils écoutent les notifications
 * et les instantanés de la simulation, sans jamais lui envoyer de commande.
 */
import type { SlackAiRequest } from '@oss/shared';
import { useEffect } from 'react';
import { metaApi } from '../../api/meta';
import { AudioPlayer } from '../../audio/player';
import { aiMessage, type SlackMessage } from '../../slack/generator';
import { SlackFeed, useSlack } from '../../slack/store';
import { onGameNotifications, useGame } from '../store/game';
import { useSettings, type Settings } from '../store/settings';
import { useSlackAiAvailable } from '../slack/useSlackAiAvailable';

const volumesOf = (settings: Settings) => ({
  // La musique a son propre lecteur, branché sur toute l'application (`ui/useMusic.ts`).
  music: settings.musicVolume,
  sfx: settings.sfxVolume,
  ambience: settings.ambienceVolume,
});

async function callAi(request: SlackAiRequest): Promise<SlackMessage[]> {
  const response = await metaApi.slackAi.message(request);
  const view = useGame.getState().view;
  return view ? response.messages.map((message) => aiMessage(message, view)) : [];
}

/**
 * Mode IA : seulement si le serveur le propose (joueur connecté, clé d'API) et si le joueur
 * a coché l'option. Décoché ou indisponible, aucun appel n'est fait : templates seulement.
 */
function useAiState() {
  const wanted = useSettings((s) => s.slackAi);
  const available = useSlackAiAvailable();
  useEffect(() => {
    useSlack.getState().setAi(wanted && available ? 'on' : 'off');
  }, [wanted, available]);
}

export function useGameFeeds() {
  useAiState();
  useEffect(() => {
    const feed = new SlackFeed({ callAi });
    const audio = new AudioPlayer(volumesOf(useSettings.getState()));
    useSlack.getState().reset();
    audio.play('keyboard');
    const stopNotifications = onGameNotifications((notifications) => {
      const view = useGame.getState().view;
      if (view && !view.replay) feed.onNotifications(view, notifications);
      audio.onNotifications(notifications);
    });
    const stopViews = useGame.subscribe((state, previous) => {
      if (state.view && previous.view && state.view !== previous.view)
        feed.onView(previous.view, state.view);
    });
    const stopSettings = useSettings.subscribe((settings) => audio.setVolumes(volumesOf(settings)));
    return () => {
      stopNotifications();
      stopViews();
      stopSettings();
      audio.stopAll();
    };
  }, []);
}
