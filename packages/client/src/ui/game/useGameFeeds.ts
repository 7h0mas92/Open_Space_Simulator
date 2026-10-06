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
import { useSession } from '../store/session';
import { useSettings, type Settings } from '../store/settings';

const volumesOf = (settings: Settings) => ({
  music: settings.musicVolume,
  sfx: settings.sfxVolume,
  ambience: settings.ambienceVolume,
});

async function callAi(request: SlackAiRequest): Promise<SlackMessage[]> {
  const response = await metaApi.slackAi.message(request);
  const view = useGame.getState().view;
  return view ? response.messages.map((message) => aiMessage(message, view)) : [];
}

/** Mode IA : seulement si le joueur l'a activé, est connecté, et si le serveur a une clé. */
function useAiState() {
  const wanted = useSettings((s) => s.slackAi);
  const online = useSession((s) => s.status === 'authenticated');
  useEffect(() => {
    const slack = useSlack.getState();
    if (!wanted || !online) {
      slack.setAi('off');
      return;
    }
    let cancelled = false;
    metaApi.slackAi
      .status()
      .then((status) => !cancelled && slack.setAi(status.enabled ? 'on' : 'unavailable'))
      .catch(() => !cancelled && slack.setAi('unavailable'));
    return () => {
      cancelled = true;
    };
  }, [wanted, online]);
}

export function useGameFeeds() {
  useAiState();
  useEffect(() => {
    const feed = new SlackFeed({ callAi });
    const audio = new AudioPlayer(volumesOf(useSettings.getState()));
    useSlack.getState().reset();
    audio.play('music');
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
