/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injector, webpack } from "replugged";
import { ActionTypes } from "./interfaces";

const inject = new Injector();

let onVoiceStateChange: (props: unknown) => void;
let onSelect: (props: {
  channelId: string;
  currentVoiceChannelId: string | null;
  guildId: string;
  stream: boolean;
  type: ActionTypes;
  video: boolean;
}) => void;

export async function start(): Promise<void> {
  const Dispatcher = await webpack.waitForModule<{
    subscribe: (event: string, callback: (props: any) => void) => void;
  }>(webpack.filters.byProps("dispatch", "register"));
  if (!Dispatcher) {
    console.error("Dispatcher not found");
    return;
  }

  const ActionTypesMod = await webpack.waitForModule(webpack.filters.byProps("VOICE_STATE_UPDATE"));
  if (!ActionTypesMod) {
    console.error("ActionTypesMod not found");
    return;
  }

  const ActionTypes = webpack.getExportsForProps(ActionTypesMod, [
    "VOICE_STATE_UPDATE",
  ]) as unknown as ActionTypes;
  if (!ActionTypes) {
    console.error("ActionTypes not found");
    return;
  }

  const getUserMod = await webpack.waitForModule(webpack.filters.byProps("getUser"));
  if (!getUserMod) {
    console.error("getUserMod not found");
    return;
  }

  onSelect = (props) => {
    console.log("onSelect", props);
  };

  onVoiceStateChange = (props) => {
    console.log(`voiceStateChange`, props);
  };

  Dispatcher.subscribe(ActionTypes.VOICE_STATE_UPDATE, onVoiceStateChange);
  Dispatcher.subscribe(ActionTypes.VOICE_CHANNEL_SELECT, onSelect);
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

  const ActionTypes = (await webpack.waitForModule(
    webpack.filters.byProps("VOICE_STATE_UPDATE"),
  )) as unknown as ActionTypes;
  if (!ActionTypes) {
    console.error("ActionTypes not found");
    return;
  }

  Dispatcher.unsubscribe(ActionTypes.VOICE_STATE_UPDATE, onVoiceStateChange);
  Dispatcher.unsubscribe(ActionTypes.VOICE_CHANNEL_SELECT, onSelect);

  inject.uninjectAll();
}
