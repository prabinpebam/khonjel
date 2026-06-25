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
  "transforms.optIn": true,
  "stt.note.diarization": true,
  "stt.note.speakerLabels": true,
  "llm.cleanup.enabled": true,
  "llm.cleanup.disableThinking": false,
  "llm.agent.reasoning": true,
  "llm.note.autoTitle": true,
  "llm.chat.reasoning": false,
  "llm.chat.autoTitle": true,
};

const DEFAULT_VALUES: Record<string, string> = {
  floatingStartPosition: "bottom-right",
  uiLanguage: "en",
  transcriptionLanguage: "en-US",
  micDevice: "default",
  loggingLevel: "info",
  // Must be a registrable global accelerator (a non-modifier key + modifiers). A modifier-only
  // chord like "Ctrl+Win" cannot be bound by Electron's globalShortcut and would silently die.
  // Mirrors DEFAULT_DICTATION_HOTKEY in electron/main/hotkeys.ts.
  "hotkey.dictation": "Ctrl+Shift+Space",
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

/**
 * Heal any persisted `*.model` values that still reference retired catalog ids. Applied both when
 * rehydrating localStorage (zustand merge) and when SettingsSync adopts the main-process settings,
 * so the pickers and the model badges always resolve a real catalog entry.
 */
export function migrateModelIds(values: Record<string, string>): Record<string, string> {
  const next = { ...values };
  for (const key of Object.keys(next)) {
    if (key.endsWith(".model")) {
      const mapped = LEGACY_MODEL_IDS[next[key] ?? ""];
      if (mapped) next[key] = mapped;
    }
  }
  return next;
}

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
          values: migrateModelIds({ ...DEFAULT_VALUES, ...(p.values ?? {}) }),
        };
      },
    },
  ),
);
