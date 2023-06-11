import { Logger } from "replugged";
import { cfg } from ".";
import { VoiceEventsSettings } from "./interfaces";

export const logger = Logger.plugin("VoiceEvents");

export const resetSettings = (): void => {
  // clear the settings
  for (const key of Object.keys(cfg.all())) {
    cfg.delete(key as keyof VoiceEventsSettings);
  }
  cfg.set("shouldResetSettings", false);
};
