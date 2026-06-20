import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Settings are modeled as two flat maps (booleans + string values) keyed by stable
 * dotted keys (e.g. "stt.dictation.mode"). This keeps the store tiny while letting
 * every control bind generically. Theme lives in its own store (stores/theme).
 */
interface SettingsState {
  toggles: Record<string, boolean>;
  values: Record<string, string>;
  setToggle: (key: string, value: boolean) => void;
  setValue: (key: string, value: string) => void;
  reset: () => void;
}

const DEFAULT_TOGGLES: Record<string, boolean> = {
  dictationSounds: true,
  pauseMedia: true,
  disableNotifications: false,
  meetingDetection: true,
  calendarReminders: true,
  updates: true,
  autoDetectCalls: true,
  autoPaste: true,
  keepInClipboard: false,
  saveNotesAsFiles: false,
  floatingAutoHide: true,
  launchAtLogin: true,
  startMinimized: false,
  preferBuiltInMic: false,
  autoLearnDictionary: true,
  cloudBackup: false,
  saveHistory: true,
  includeDiscarded: false,
  "transforms.optIn": true,
  "stt.dictation.preview": true,
  "stt.note.diarization": true,
  "stt.note.speakerLabels": true,
  "llm.cleanup.enabled": true,
  "llm.cleanup.disableThinking": false,
  "llm.agent.reasoning": true,
  "llm.note.autoTitle": true,
  "llm.chat.reasoning": false,
};

const DEFAULT_VALUES: Record<string, string> = {
  floatingStartPosition: "bottom-right",
  uiLanguage: "en",
  transcriptionLanguage: "en-US",
  micDevice: "default",
  audioRetentionDays: "30",
  loggingLevel: "info",
  "hotkey.dictation": "Ctrl+Win",
  "hotkey.dictation.mode": "tap",
  "hotkey.voiceAgent": "",
  "hotkey.meeting": "",
  "hotkey.meeting.layout": "side-panel",
  "hotkey.chatAgent": "",
  "stt.dictation.mode": "local",
  "stt.dictation.localProvider": "whisper",
  "stt.dictation.model": "whisper-large-v3",
  "stt.dictation.provider": "deepgram",
  "stt.note.mode": "local",
  "stt.note.localProvider": "whisper",
  "stt.note.model": "whisper-large-v3",
  "llm.cleanup.mode": "local",
  "llm.cleanup.model": "qwen-3.5-4b",
  "llm.cleanup.provider": "openai",
  "llm.agent.mode": "local",
  "llm.agent.model": "qwen-3.5-4b",
  "llm.agent.provider": "openai",
  "llm.note.mode": "local",
  "llm.note.model": "qwen-3.5-4b",
  "llm.note.provider": "openai",
  "llm.chat.mode": "local",
  "llm.chat.model": "qwen-3.5-4b",
  "llm.chat.provider": "openai",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      toggles: DEFAULT_TOGGLES,
      values: DEFAULT_VALUES,
      setToggle: (key, value) => set((s) => ({ toggles: { ...s.toggles, [key]: value } })),
      setValue: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
      reset: () => set({ toggles: DEFAULT_TOGGLES, values: DEFAULT_VALUES }),
    }),
    {
      name: "khonjel.settings",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          toggles: { ...DEFAULT_TOGGLES, ...(p.toggles ?? {}) },
          values: { ...DEFAULT_VALUES, ...(p.values ?? {}) },
        };
      },
    },
  ),
);
