import type { ContentService } from "@services/ports";
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
};
