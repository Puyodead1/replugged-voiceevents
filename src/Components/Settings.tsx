import { common, components, util } from "replugged";
import { cfg } from "..";
import { findCurrentVoiceURI } from "../Voice";
import { VoiceEventsSettings } from "../interfaces";
import { resetSettings } from "../utils";
const { SwitchItem, SelectItem, SliderItem, FormItem, TextInput, Category, Divider, Button, Text } =
  components;
const { React } = common;

const ManifestJSON = require("../../manifest.json");

export function Settings() {
  const [canReset, setCanReset] = React.useState(true);
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const voice = util.useSetting(cfg, "voice");
  const notifs = util.useSetting(cfg, "notifications");
  const [notifications, setNotifications] = React.useState<VoiceEventsSettings["notifications"]>(
    notifs.value!,
  );

  React.useEffect(() => {
    const getVoices = () => {
      const voices = speechSynthesis.getVoices();
      setVoices(voices);
    };

    getVoices();
    // eslint-disable-next-line no-undefined
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = getVoices;
    }
  }, []);

  React.useEffect(() => {
    notifs.onChange(notifications);
  }, [notifications]);

  return (
    <div>
      <SwitchItem {...util.useSetting(cfg, "filterNames")}>
        Remove non-alphanumeric characters (Filter Names)
      </SwitchItem>
      <SwitchItem {...util.useSetting(cfg, "filterBots")}>Ignore Bots</SwitchItem>
      <SwitchItem {...util.useSetting(cfg, "filterStages")}>Ignore Stage Channels</SwitchItem>
      <SelectItem
        value={findCurrentVoiceURI()}
        onChange={voice.onChange}
        options={voices.map((x) => ({
          label: x.name,
          value: x.voiceURI,
        }))}>
        Select Voice
      </SelectItem>
      <SliderItem
        {...util.useSetting(cfg, "volume", 100)}
        minValue={0}
        maxValue={100}
        markers={[0, 25, 50, 75, 100]}>
        Volume
      </SliderItem>
      <SliderItem
        {...util.useSetting(cfg, "speed", 1)}
        minValue={1}
        maxValue={10}
        markers={[1, 5, 10]}>
        Speed
      </SliderItem>
      <FormItem
        title="Unknown Channel Text"
        note="The message for channels with an unknown name (DMs)"
        style={{
          marginBottom: 20,
        }}>
        <TextInput {...util.useSetting(cfg, "unknownChannel")} />
      </FormItem>

      <Divider />

      <div style={{ margin: "20px 0" }}>
        <Category title="Notification Event Settings">
          {Object.keys(notifications).map((key) => {
            const setting = notifications[key as keyof VoiceEventsSettings["notifications"]];

            return (
              <Category title={key.substring(0, 1).toUpperCase() + key.substring(1)}>
                <SwitchItem
                  value={setting.enabled}
                  onChange={(e) => {
                    setNotifications({ ...notifications, [key]: { ...setting, enabled: e } });
                  }}>
                  Enabled
                </SwitchItem>

                <FormItem title="Message" note="The message to be played">
                  <TextInput
                    onChange={(e) => {
                      setNotifications({ ...notifications, [key]: { ...setting, message: e } });
                    }}
                    value={setting.message}
                  />
                </FormItem>
              </Category>
            );
          })}
        </Category>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
          <Button
            onClick={() => {
              resetSettings();
              setCanReset(false);
            }}
            style={{ margin: "0 5px" }}
            color={Button.Colors.RED}
            disabled={!canReset}>
            Reset Settings
          </Button>
        </div>
        <Text style={{ textAlign: "center" }}>VoiceEvents V{ManifestJSON.version}</Text>
      </div>

      <div style={{ color: "white" }}>
        <Text>Notification Event Messages can use the following variables:</Text>

        <ul>
          <li style={{ listStyle: "disc" }}>
            <Text>
              <code>{`$username`}</code> - The username of the user that joined/left the channel
            </Text>
          </li>
          <li style={{ listStyle: "disc" }}>
            <Text>
              <code>{`$nickname`}</code> - The nickname of the user that joined/left the channel
            </Text>
          </li>
          <li style={{ listStyle: "disc" }}>
            <Text>
              <code>{`$channel`}</code> - The name of the channel that was joined/left
            </Text>
          </li>
        </ul>
      </div>
    </div>
  );
}
