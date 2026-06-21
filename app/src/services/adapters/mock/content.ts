import type { ContentService, HistoryEntry } from "@services/ports";
import * as seed from "@mock/seed";

/** Mock content — resolves seed data immediately. Real adapters (Electron IPC) swap in later. */
export const mockContentService: ContentService = {
  history: async () => seed.HISTORY,
  insights: async () => seed.INSIGHTS,
  chat: async () => seed.CHAT,
  folders: async () => seed.FOLDERS,
  notes: async () => seed.NOTES,
  uploads: async () => seed.UPLOADS,
  dictionary: async () => seed.DICTIONARY,
  snippets: async () => seed.SNIPPETS,
  transforms: async () => seed.TRANSFORMS,
  integrations: async () => seed.INTEGRATIONS,
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
    return [entry, ...seed.HISTORY];
  },
};
