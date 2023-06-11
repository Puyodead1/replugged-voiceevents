export interface VoiceState {
  channelId: string;
  deaf: boolean;
  guildId: string;
  mute: boolean;
  requestToSpeakTimestamp: string | null;
  selfDeaf: boolean;
  selfMute: boolean;
  selfStream: boolean;
  selfVideo: boolean;
  sessionId: string;
  suppress: boolean;
  userId: string;
}

export interface VoiceStateAction {
  type: "VOICE_STATE_UPDATES";
  initial?: boolean;
  voiceStates: VoiceState[];
}

export const VoiceChatNotificationsDefaultSettings = {
  voice: null as unknown as string,
  volume: 100,
  speed: 1,
  filterNames: true,
  filterBots: false,
  filterStages: true,
  notifications: {
    mute: {
      enabled: true,
      message: "Muted",
    },
    unmute: {
      enabled: true,
      message: "Unmuted",
    },
    deafen: {
      enabled: true,
      message: "Deafened",
    },
    undeafen: {
      enabled: true,
      message: "Undeafened",
    },
    join: {
      enabled: true,
      message: "$nickname joined your channel",
    },
    leave: {
      enabled: true,
      message: "$nickname left your channel",
    },
    joinSelf: {
      enabled: true,
      message: "You joined $channel",
    },
    moveSelf: {
      enabled: true,
      message: "You were moved to $channel",
    },
    leaveSelf: {
      enabled: true,
      message: "You left $channel",
    },
  },
  unknownChannel: "The call",
  shouldResetSettings: false,
};

export type VoiceEventsSettings = typeof VoiceChatNotificationsDefaultSettings;
export type NotificationType =
  keyof (typeof VoiceChatNotificationsDefaultSettings)["notifications"];
