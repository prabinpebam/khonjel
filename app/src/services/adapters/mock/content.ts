import type { ContentService } from "@services/ports";
import * as seed from "@mock/seed";

/** Mock content — returns seed data. Real adapters (Electron IPC) swap in later. */
export const mockContentService: ContentService = {
  history: () => seed.HISTORY,
  insights: () => seed.INSIGHTS,
  chat: () => seed.CHAT,
  folders: () => seed.FOLDERS,
  notes: () => seed.NOTES,
  uploads: () => seed.UPLOADS,
  dictionary: () => seed.DICTIONARY,
  snippets: () => seed.SNIPPETS,
  transforms: () => seed.TRANSFORMS,
  integrations: () => seed.INTEGRATIONS,
  sttModels: () => seed.STT_MODELS,
  llmModels: () => seed.LLM_MODELS,
};
