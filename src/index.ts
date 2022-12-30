/* eslint-disable @typescript-eslint/no-explicit-any */
import { User } from "discord-types/general";
import {
  ChannelStore as ChannelStoreType,
  GuildMemberStore as GuildMemberStoreType,
  SelectedChannelStore,
  UserStore,
} from "discord-types/stores";
import { Injector, settings, webpack } from "replugged";
import {
  VoiceChatNotificationsDefaultSettings as VoiceEventsDefaultSettings,
  VoiceEventsSettings,
  VoiceState,
  VoiceStateAction,
} from "./interfaces";
import { notify } from "./Voice";

const inject = new Injector();
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
    console.log("[VoiceEvents] Resetting settings");
    // clear the settings
    for (const key of Object.keys(cfg.all())) {
      cfg.delete(key as any);
    }
    cfg.set("shouldReset" as any, false);
  }

  // add any new settings
  for (const [key, value] of Object.entries(VoiceEventsDefaultSettings)) {
    if (!cfg.has(key as any)) {
      console.log(`[VoiceEvents] Adding new settings ${key} with value`, value);
      cfg.set(key as any, value as any);
    }
  }

  // update any settings that have changed
  // for (const key of Object.keys(DefaultSettings)) {
  //   const value = cfg.get(key);
  //   if (value !== DefaultSettings[key]) {
  //     console.log(`[StaffTags] Updating setting ${key} to`, DefaultSettings[key]);
  //     cfg.set(key, DefaultSettings[key]);
  //   }
  // }

  // remove any settings that no longer exist
  // for (const key of Object.keys(cfg.all())) {
  //   if (!(key in DefaultSettings)) {
  //     console.log(`[StaffTags] Removing setting ${key} because it no longer exists`);
  //     cfg.delete(key);
  //   }
  // }

  const Dispatcher = await webpack.waitForModule<{
    subscribe: (event: string, callback: (props: any) => void) => void;
  }>(webpack.filters.byProps("dispatch", "register"));
  if (!Dispatcher) {
    console.error("[VoiceEvents] Dispatcher not found");
    return;
  }

  const UserStore = (await webpack.waitForModule(
    webpack.filters.byProps("getUser"),
  )) as unknown as UserStore;
  if (!UserStore) {
    console.error("[VoiceEvents] UserStore not found");
    return;
  }

  const SelectedChannelStoreMod = await webpack.waitForModule(
    webpack.filters.byProps("getVoiceChannelId"),
  );
  if (!SelectedChannelStoreMod) {
    console.error("[VoiceEvents] SelectedChannelStoreMod not found");
    return;
  }

  const SelectedChannelStore = webpack.getExportsForProps(SelectedChannelStoreMod as any, [
    "getVoiceChannelId",
  ]) as unknown as SelectedChannelStore;

  const ChannelStore = (await webpack.waitForModule(
    webpack.filters.byProps("getChannel"),
  )) as any as ChannelStoreType;
  if (!ChannelStore) {
    console.error("[VoiceEvents] ChannelStore not found");
    return;
  }

  const GuildMemberStoreMod = (await webpack.waitForModule(
    webpack.filters.byProps("getMember", "getMembers"),
  )) as unknown as GuildMemberStoreType;
  if (!GuildMemberStoreMod) {
    console.error("[VoiceEvents] GuildMemberStoreMod not found");
    return;
  }
  const GuildMemberStore = webpack.getExportsForProps(GuildMemberStoreMod as any, [
    "getMembers",
  ]) as unknown as GuildMemberStoreType;

  const MediaEngineStore = await webpack.waitForModule<{
    isSelfMute: () => boolean;
    isSelfDeaf: () => boolean;
  }>(webpack.filters.byProps("isSelfMute"));
  if (!GuildMemberStoreMod) {
    console.error("[VoiceEvents] GuildMemberStoreMod not found");
    return;
  }

  currentUser = UserStore.getCurrentUser();

  onVoiceStateUpdate = (e) => {
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
              UserStore,
              ChannelStore,
              GuildMemberStore,
            );
            saveStates(e.voiceStates);
          } else if (!prevState) {
            // joined channel
            notify("joinSelf", userId, channelId, cfg, UserStore, ChannelStore, GuildMemberStore);
            saveStates(e.voiceStates);
          } else if (channelId !== prevState.channelId) {
            // moved channel
            notify("moveSelf", userId, channelId, cfg, UserStore, ChannelStore, GuildMemberStore);
            saveStates(e.voiceStates);
          }
        } else {
          const selectedChannelId = SelectedChannelStore.getVoiceChannelId();

          // user is not in voice
          if (!selectedChannelId) return;

          if (!prevState && channelId === selectedChannelId) {
            // user joined
            notify("join", userId, channelId, cfg, UserStore, ChannelStore, GuildMemberStore);
            saveStates(e.voiceStates);
          } else if (prevState && !channelId) {
            // user left
            notify(
              "leave",
              userId,
              selectedChannelId,
              cfg,
              UserStore,
              ChannelStore,
              GuildMemberStore,
            );
            saveStates(e.voiceStates);
          }
        }
      } catch (e) {
        console.error("[VoiceEvents] Error processing voice state change", e);
      }
    }
  };

  onSelfMute = () => {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) {
      console.warn("[VoiceEvents] self mute - couldnt get channel id");
      return;
    }
    notify(
      MediaEngineStore.isSelfMute() ? "mute" : "unmute",
      currentUser.id,
      channelId,
      cfg,
      UserStore,
      ChannelStore,
      GuildMemberStore,
    );
  };

  onSelfDeaf = () => {
    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) {
      console.warn("[VoiceEvents] self deaf - couldnt get channel id");
      return;
    }
    notify(
      MediaEngineStore.isSelfDeaf() ? "deafen" : "undeafen",
      currentUser.id,
      channelId,
      cfg,
      UserStore,
      ChannelStore,
      GuildMemberStore,
    );
  };

  Dispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);
  console.log("[VoiceEvents] subscribed to voice state actions");
  Dispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", onSelfMute);
  console.log("[VoiceEvents] subscribed to self mute actions");
  Dispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", onSelfDeaf);
  console.log("[VoiceEvents] subscribed to self deaf actions");
}

export async function stop(): Promise<void> {
  const Dispatcher = await webpack.waitForModule<{
    subscribe: (event: string, callback: (props: any) => void) => void;
    unsubscribe: (event: string, callback: (props: any) => void) => void;
  }>(webpack.filters.byProps("dispatch", "register"));
  if (!Dispatcher) {
    console.error("Dispatcher not found");
    return;
  }

  Dispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdate);
  console.log("[VoiceEvents] unsubscribed to voice state actions");
  Dispatcher.unsubscribe("AUDIO_TOGGLE_SELF_MUTE", onSelfMute);
  console.log("[VoiceEvents] unsubscribed to self mute actions");
  Dispatcher.unsubscribe("AUDIO_TOGGLE_SELF_DEAF", onSelfDeaf);
  console.log("[VoiceEvents] unsubscribed to self deaf actions");

  inject.uninjectAll();
}
