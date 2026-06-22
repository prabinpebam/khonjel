import type { ContentService, HistoryEntry } from "@services/ports";
import * as seed from "@mock/seed";

/**
 * Mock content — a stateful in-memory copy of the seed data so edits (notes, dictionary, etc.)
 * survive within a browser session, mirroring the durable store under Electron. Reset on reload.
 */
const state = {
  history: [...seed.HISTORY],
  chat: [...seed.CHAT],
  folders: [...seed.FOLDERS],
  notes: [...seed.NOTES],
  uploads: [...seed.UPLOADS],
  dictionary: [...seed.DICTIONARY],
  snippets: [...seed.SNIPPETS],
  transforms: [...seed.TRANSFORMS],
  integrations: [...seed.INTEGRATIONS],
};

// Live content-change subscribers (mirrors the main-process broadcast under Electron).
const listeners = new Set<(collection: string) => void>();
function notify(collection: string): void {
  for (const cb of listeners) cb(collection);
}

export const mockContentService: ContentService = {
  history: async () => state.history,
  insights: async () => seed.INSIGHTS,
  chat: async () => state.chat,
  folders: async () => state.folders,
  notes: async () => state.notes,
  uploads: async () => state.uploads,
  dictionary: async () => state.dictionary,
  snippets: async () => state.snippets,
  transforms: async () => state.transforms,
  integrations: async () => state.integrations,
  sttModels: async () => seed.STT_MODELS,
  llmModels: async () => seed.LLM_MODELS,
  addHistory: async (draft) => {
    const words = draft.finalText.trim();
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      wordCount: words.length > 0 ? words.split(/\s+/).length : 0,
      ...draft,
    };
    state.history = [entry, ...state.history];
    notify("history");
    return state.history;
  },
  saveHistory: async (entries) => {
    state.history = entries;
  },
  saveNotes: async (notes) => {
    state.notes = notes;
  },
  saveFolders: async (folders) => {
    state.folders = folders;
  },
  saveDictionary: async (entries) => {
    state.dictionary = entries;
  },
  saveSnippets: async (snippets) => {
    state.snippets = snippets;
  },
  saveTransforms: async (transforms) => {
    state.transforms = transforms;
  },
  saveIntegrations: async (integrations) => {
    state.integrations = integrations;
  },
  saveChat: async (messages) => {
    state.chat = messages;
  },
  saveUploads: async (jobs) => {
    state.uploads = jobs;
  },
  onChanged: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
