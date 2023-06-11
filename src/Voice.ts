/* eslint-disable  */
import { Channel, User } from "discord-types/general";
import { ChannelStore, GuildMemberStore } from "discord-types/stores";
import { common } from "replugged";
import { SettingsManager } from "replugged/dist/renderer/apis/settings";
import {
  NotificationType,
  VoiceChatNotificationsDefaultSettings as VoiceEventsDefaultSettings,
  VoiceEventsSettings,
} from "./interfaces";
import { logger } from "./utils";
import { cfg } from ".";

const { users } = common;

export const findDefaultVoice = (): SpeechSynthesisVoice | null => {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    logger.error("[VoiceEvents] No speech synthesis voices available");
    return null;
  } else {
    return voices.find((voice) => voice.lang === "en-US") ?? voices[0];
  }
};

export const findCurrentVoice = (): SpeechSynthesisVoice | null => {
  const uri = cfg.get("voice");
  const voice = speechSynthesis.getVoices().find((voice) => voice.voiceURI === uri);
  if (voice) {
    return voice;
  } else {
    logger.warn(`Voice "${uri}" not found, reverting to default`);
    const defaultVoice = findDefaultVoice();
    if (defaultVoice) cfg.set("voice", defaultVoice.voiceURI);
    return defaultVoice;
  }
};

export const findCurrentVoiceURI = (): string | undefined => {
  return findCurrentVoice()?.voiceURI;
};

export const speak = (message: string): void => {
  const { volume, speed } = cfg.all();

  const voice = findCurrentVoice();
  if (!voice) return;

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.voice = voice;
  utterance.volume = volume! / 100;
  utterance.rate = speed!;

  speechSynthesis.speak(utterance);
};

const processName = (
  name: string,
  cfg: SettingsManager<VoiceEventsSettings, keyof VoiceEventsSettings>,
) => {
  return cfg.get("filterNames", VoiceEventsDefaultSettings.filterNames)
    ? name
        .split("")
        .map((char) => (/[a-zA-Z0-9]/.test(char) ? char : " "))
        .join("")
    : name;
};

export const notify = (
  type: NotificationType,
  userId: string,
  channelId: string,
  cfg: SettingsManager<VoiceEventsSettings, keyof VoiceEventsSettings>,
  ChannelStore: ChannelStore,
  GuildMemberStore: GuildMemberStore,
): void => {
  const settings = cfg.all();

  // check for enabled
  if (!settings.notifications[type].enabled) {
    return;
  }

  const user = users.getUser(userId) as User;
  const channel = ChannelStore.getChannel(channelId) as Channel;

  // check for filters
  if (
    (settings.filterBots && user?.bot) ||
    (settings.filterStages && channel?.isGuildStageVoice())
  ) {
    return;
  }

  // resolve names
  const nick = GuildMemberStore.getMember(channel?.getGuildId(), userId)?.nick ?? user.username;
  const channelName =
    !channel || channel.isDM() || channel.isGroupDM() ? settings.unknownChannel : channel.name;

  // speak message
  speak(
    settings.notifications[type].message
      .split("$username")
      .join(processName(user.username, cfg))
      .split("$nickname")
      .join(processName(nick, cfg))
      .split("$channel")
      .join(processName(channelName, cfg)),
  );
};
