import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "@stores/theme";
import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Segmented } from "@components/ui/segmented";
import { SelectRow, ToggleRow } from "../controls";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "ko", label: "Korean" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
];

export function GeneralSettings() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div>
      <SettingGroup label="Appearance">
        <SettingRow
          title="Theme"
          subtitle="Light, dark, or follow the system."
          control={
            <Segmented<Theme>
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "auto", label: "Auto", icon: Monitor },
              ]}
            />
          }
        />
      </SettingGroup>

      <SettingGroup label="Sound effects">
        <ToggleRow title="Dictation sounds" settingKey="dictationSounds" />
        <ToggleRow title="Pause media while dictating" settingKey="pauseMedia" />
      </SettingGroup>

      <SettingGroup label="Notifications">
        <ToggleRow title="Disable all notifications" settingKey="disableNotifications" />
        <ToggleRow
          title="Meeting detection"
          subtitle="Detect Zoom, Teams, and FaceTime calls."
          settingKey="meetingDetection"
        />
        <ToggleRow title="Calendar reminders" settingKey="calendarReminders" />
        <ToggleRow title="Update notifications" settingKey="updates" />
      </SettingGroup>

      <SettingGroup label="Clipboard">
        <ToggleRow title="Auto-paste at cursor" settingKey="autoPaste" />
        <ToggleRow title="Keep transcription in clipboard" settingKey="keepInClipboard" />
      </SettingGroup>

      <SettingGroup label="Save notes as files">
        <ToggleRow
          title="Save notes as files"
          subtitle="Write each note to a folder on disk."
          settingKey="saveNotesAsFiles"
        />
      </SettingGroup>

      <SettingGroup label="Floating icon">
        <ToggleRow title="Auto-hide when not in focus" settingKey="floatingAutoHide" />
        <SelectRow
          title="Start position"
          settingKey="floatingStartPosition"
          options={[
            { value: "bottom-right", label: "Bottom right" },
            { value: "center", label: "Center" },
            { value: "bottom-left", label: "Bottom left" },
          ]}
        />
      </SettingGroup>

      <SettingGroup label="Language">
        <SelectRow title="Interface language" settingKey="uiLanguage" options={LOCALES} />
        <SelectRow
          title="Transcription language"
          settingKey="transcriptionLanguage"
          options={[
            { value: "en-US", label: "English (US)" },
            { value: "en-GB", label: "English (UK)" },
            { value: "es-ES", label: "Spanish" },
            { value: "fr-FR", label: "French" },
            { value: "de-DE", label: "German" },
            { value: "ja-JP", label: "Japanese" },
          ]}
        />
      </SettingGroup>

      <SettingGroup label="Startup">
        <ToggleRow title="Launch at login" settingKey="launchAtLogin" />
        <ToggleRow title="Start minimized" settingKey="startMinimized" />
      </SettingGroup>

      <SettingGroup label="Microphone">
        <ToggleRow title="Prefer built-in microphone" settingKey="preferBuiltInMic" />
        <SelectRow
          title="Input device"
          settingKey="micDevice"
          options={[
            { value: "default", label: "System default" },
            { value: "builtin", label: "Built-in microphone" },
            { value: "usb", label: "USB microphone" },
          ]}
        />
      </SettingGroup>

      <SettingGroup label="Dictionary">
        <ToggleRow
          title="Auto-learn from corrections"
          subtitle="Add corrected words to your personal dictionary."
          settingKey="autoLearnDictionary"
        />
      </SettingGroup>
    </div>
  );
}
