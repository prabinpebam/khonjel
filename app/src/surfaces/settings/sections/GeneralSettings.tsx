import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore, type Theme } from "@stores/theme";
import { useSettingsStore } from "@stores/settings";
import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Segmented } from "@components/ui/segmented";
import { Select } from "@components/ui/select";
import { SelectRow, ToggleRow } from "../controls";

/** Input-device picker backed by the real list of microphones (navigator.mediaDevices). */
function MicDeviceRow() {
  const value = useSettingsStore((s) => s.values["micDevice"] ?? "default");
  const setValue = useSettingsStore((s) => s.setValue);
  const [devices, setDevices] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default",
        );
        if (live) setDevices(inputs.map((d, i) => ({ value: d.deviceId, label: d.label || `Microphone ${i + 1}` })));
      } catch {
        /* permission not granted yet -> only the system default is offered */
      }
    };
    void load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => {
      live = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", load);
    };
  }, []);

  return (
    <SettingRow
      title="Input device"
      subtitle={
        devices.length === 0 ? "Grant microphone access to choose a specific device." : undefined
      }
      control={
        <Select
          aria-label="Input device"
          value={value}
          onValueChange={(v) => setValue("micDevice", v)}
          options={[{ value: "default", label: "System default" }, ...devices]}
          className="min-w-44"
        />
      }
    />
  );
}

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
        <MicDeviceRow />
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
