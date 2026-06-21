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
  "stt.dictation.model": "ggml-base.en.bin",
  "stt.dictation.provider": "deepgram",
  "stt.note.mode": "local",
  "stt.note.localProvider": "whisper",
  "stt.note.model": "ggml-base.en.bin",
  "llm.cleanup.mode": "local",
  "llm.cleanup.model": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  "llm.cleanup.provider": "openai",
  "llm.agent.mode": "local",
  "llm.agent.model": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  "llm.agent.provider": "openai",
  "llm.note.mode": "local",
  "llm.note.model": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  "llm.note.provider": "openai",
  "llm.chat.mode": "local",
  "llm.chat.model": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  "llm.chat.provider": "openai",
};

/** Old mock model ids -> current catalog ids, applied when loading persisted settings. */
const LEGACY_MODEL_IDS: Record<string, string> = {
  "whisper-large-v3": "ggml-base.en.bin",
  "whisper-medium": "ggml-small.bin",
  "whisper-base": "ggml-base.en.bin",
  "parakeet-tdt": "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3",
  "qwen-3.5-4b": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
  "llama-3.3-8b": "llama-3.2-3b-instruct-q4_k_m.gguf",
  "phi-4-mini": "qwen2.5-3b-instruct-q4_k_m.gguf",
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
        const values = { ...DEFAULT_VALUES, ...(p.values ?? {}) };
        // Migrate model ids saved before the catalog ids were unified (keeps pickers + badges resolving).
        for (const key of Object.keys(values)) {
          if (key.endsWith(".model")) {
            const mapped = LEGACY_MODEL_IDS[values[key] ?? ""];
            if (mapped) values[key] = mapped;
          }
        }
        return {
          ...current,
          toggles: { ...DEFAULT_TOGGLES, ...(p.toggles ?? {}) },
          values,
        };
      },
    },
  ),
);
