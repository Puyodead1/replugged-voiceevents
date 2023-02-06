/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "discord-types/general";
import {
  ChannelStore as ChannelStoreType,
  GuildMemberStore as GuildMemberStoreType,
  SelectedChannelStore,
} from "discord-types/stores";
import { Injector, common, settings, webpack } from "replugged";
import {
  VoiceChatNotificationsDefaultSettings as VoiceEventsDefaultSettings,
  VoiceEventsSettings,
  VoiceState,
  VoiceStateAction,
} from "./interfaces";
import { logger } from "./utils";
import { notify } from "./Voice";

const inject = new Injector();
const { fluxDispatcher, users } = common;

let currentUser: User;
let statesCache: Record<string, VoiceState> = {};

let onVoiceStateUpdate: (e: VoiceStateAction) => void;
let onSelfMute: () => void;
let onSelfDeaf: () => void;

const saveStates = (states: VoiceState[]): void => {
  statesCache = states.reduce<Record<string, VoiceState>>((acc, state) => {
    acc[state.userId] = state;
    return acc;
  }, {});
};

export async function start(): Promise<void> {
  const cfg = await settings.init<VoiceEventsSettings>("me.puyodead1.VoiceEvents");

  if (cfg.get("shouldResetSettings", VoiceEventsDefaultSettings.shouldResetSettings)) {
    logger.log("Resetting settings");
    // clear the settings
    for (const key of Object.keys(cfg.all())) {
      cfg.delete(key as any);
    }
    cfg.set("shouldReset" as any, false);
  }

  // add any new settings
  for (const [key, value] of Object.entries(VoiceEventsDefaultSettings)) {
    if (!cfg.has(key as any)) {
      logger.log(`Adding new settings ${key} with value`, value);
      cfg.set(key as any, value as any);
    }
  }

  // update any settings that have changed
  // for (const key of Object.keys(DefaultSettings)) {
  //   const value = cfg.get(key);
  //   if (value !== DefaultSettings[key]) {
  //     logger.log(`Updating setting ${key} to`, DefaultSettings[key]);
  //     cfg.set(key, DefaultSettings[key]);
  //   }
  // }

  // remove any settings that no longer exist
  // for (const key of Object.keys(cfg.all())) {
  //   if (!(key in DefaultSettings)) {
  //     logger.log(`Removing setting ${key} because it no longer exists`);
  //     cfg.delete(key);
  //   }
  // }

  const ChannelStore = (await webpack.waitForModule(
    webpack.filters.byProps("getChannel"),
  )) as any as ChannelStoreType;
  if (!ChannelStore) {
    console.error("ChannelStore not found");
    return;
  }

  const SelectedChannelStoreMod = await webpack.waitForModule(
    webpack.filters.byProps("getVoiceChannelId"),
  );
  if (!SelectedChannelStoreMod) {
    logger.error("SelectedChannelStoreMod not found");
    return;
  }

  const SelectedChannelStore = webpack.getExportsForProps(SelectedChannelStoreMod as any, [
    "getVoiceChannelId",
  ]) as unknown as SelectedChannelStore;

  const GuildMemberStoreMod = await webpack.waitForModule(
    webpack.filters.byProps("getMember", "getMembers"),
  );
  if (!GuildMemberStoreMod) {
    logger.error("GuildMemberStoreMod not found");
    return;
  }
  const GuildMemberStore = webpack.getExportsForProps(GuildMemberStoreMod, [
    "getMembers",
  ]) as unknown as GuildMemberStoreType;

  const MediaEngineStore = await webpack.waitForModule<{
    isSelfMute: () => boolean;
    isSelfDeaf: () => boolean;
  }>(webpack.filters.byProps("isSelfMute"));
  if (!GuildMemberStoreMod) {
    logger.error("GuildMemberStoreMod not found");
    return;
  }

  currentUser = users.getCurrentUser();

  onVoiceStateUpdate = (e) => {
    if (!currentUser) {
      logger.warn("Failed to get current user!");
      return;
    }
    if (e.initial) return saveStates(e.voiceStates);

    for (const { userId, channelId } of e.voiceStates) {
      try {
        const prevState = statesCache[userId];

        if (userId === currentUser.id) {
          // user is self
          if (!channelId) {
            // left channel
            notify(
              "leaveSelf",
              userId,
              prevState.channelId,
              cfg,

              ChannelStore,
              GuildMemberStore,
            );
            saveStates(e.voiceStates);
          } else if (!prevState) {
            // joined channel
            notify("joinSelf", userId, channelId, cfg, ChannelStore, GuildMemberStore);
            saveStates(e.voiceStates);
          } else if (channelId !== prevState.channelId) {
            // moved channel
            notify("moveSelf", userId, channelId, cfg, ChannelStore, GuildMemberStore);
            saveStates(e.voiceStates);
          }
        } else {
          const selectedChannelId = SelectedChannelStore.getVoiceChannelId();

          // user is not in voice
          if (!selectedChannelId) return;

          if (!prevState && channelId === selectedChannelId) {
            // user joined
            notify("join", userId, channelId, cfg, ChannelStore, GuildMemberStore);
            saveStates(e.voiceStates);
          } else if (prevState && !channelId) {
            // user left
            notify(
              "leave",
              userId,
              selectedChannelId,
              cfg,

              ChannelStore,
              GuildMemberStore,
            );
            saveStates(e.voiceStates);
          }
        }
      } catch (e) {
        logger.error("Error processing voice state change", e);
      }
    }
  };

  onSelfMute = () => {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) {
      logger.warn("self mute - couldnt get channel id");
      return;
    }
    notify(
      MediaEngineStore.isSelfMute() ? "mute" : "unmute",
      currentUser.id,
      channelId,
      cfg,
      ChannelStore,
      GuildMemberStore,
    );
  };

  onSelfDeaf = () => {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) {
      logger.warn("self deaf - couldnt get channel id");
      return;
    }
    notify(
      MediaEngineStore.isSelfDeaf() ? "deafen" : "undeafen",
      currentUser.id,
      channelId,
      cfg,
      ChannelStore,
      GuildMemberStore,
    );
  };

  fluxDispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate as any);
  logger.log("subscribed to voice state actions");
  fluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", onSelfMute);
  logger.log("subscribed to self mute actions");
  fluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", onSelfDeaf);
  logger.log("subscribed to self deaf actions");
}

export function stop(): void {
  fluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate as any);
  logger.log("unsubscribed to voice state actions");
  fluxDispatcher.unsubscribe("AUDIO_TOGGLE_SELF_MUTE", onSelfMute);
  logger.log("unsubscribed to self mute actions");
  fluxDispatcher.unsubscribe("AUDIO_TOGGLE_SELF_DEAF", onSelfDeaf);
  logger.log("unsubscribed to self deaf actions");

  inject.uninjectAll();
}
