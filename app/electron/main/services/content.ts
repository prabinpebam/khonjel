/**
 * Content domain service (main): the durable source of the read-only collections the views
 * render (history, notes, dictionary, ...), plus the derived reads (insights computed from
 * history, model lists from the catalog). User collections persist as one JSON document
 * (native-free, like settings/connections); the catalog + insights are computed, not stored.
 *
 * A fresh install starts EMPTY for user data and ships default catalogs for integrations and
 * builtin transforms. Real capture/notes features append to these collections in later phases.
 * IO + catalog/insights are injected -> BE1-testable without fs, electron, or native modules.
 * See backend/09 SS3 (durable content) + 07 SSC (insights computed on read).
 */
import type {
  ChatMessage,
  ChatThread,
  DictionaryEntry,
  Folder,
  HistoryDraft,
  HistoryEntry,
  InsightsAggregate,
  Integration,
  ModelInfo,
  Note,
  Snippet,
  Transform,
  UploadJob,
} from "../../../src/services/ports";
import type { SettingsIO } from "./settings";

/** The persisted user collections (everything the user accumulates or edits over time). */
export interface ContentDoc {
  history: HistoryEntry[];
  chat: ChatMessage[];
  chatThreads: ChatThread[];
  folders: Folder[];
  notes: Note[];
  uploads: UploadJob[];
  dictionary: DictionaryEntry[];
  snippets: Snippet[];
  transforms: Transform[];
  integrations: Integration[];
}

/** Catalog + insights are computed, never stored -- injected so the store stays pure/testable. */
export interface ContentDeps {
  listModels: (kind: "stt" | "llm") => ModelInfo[];
  computeInsights: (history: HistoryEntry[]) => InsightsAggregate;
  /** Privacy retention: dictation history older than this many days is purged (0/undefined = keep). */
  retentionDays?: () => number;
}

/** The user-owned collections a renderer feature may replace wholesale. */
export const CONTENT_COLLECTIONS = [
  "history",
  "chat",
  "chatThreads",
  "folders",
  "notes",
  "uploads",
  "dictionary",
  "snippets",
  "transforms",
  "integrations",
] as const;
export type ContentCollection = (typeof CONTENT_COLLECTIONS)[number];

export interface ContentStore {
  history: () => HistoryEntry[];
  insights: () => InsightsAggregate;
  chat: () => ChatMessage[];
  chatThreads: () => ChatThread[];
  folders: () => Folder[];
  notes: () => Note[];
  uploads: () => UploadJob[];
  dictionary: () => DictionaryEntry[];
  snippets: () => Snippet[];
  transforms: () => Transform[];
  integrations: () => Integration[];
  sttModels: () => ModelInfo[];
  llmModels: () => ModelInfo[];
  addHistory: (draft: HistoryDraft) => HistoryEntry[];
  replace: (collection: string, items: unknown[]) => void;
}

/** Builtin transforms shipped on a fresh install (non-builtin ones are user-created later). */
const DEFAULT_TRANSFORMS: Transform[] = [
  {
    id: "polish",
    name: "Polish",
    description: "Improve clarity and conciseness.",
    hotkey: "Win+Alt+1",
    builtin: true,
    enabled: true,
    prompt:
      "You are an editing assistant. Rewrite the user's text to improve clarity and conciseness " +
      "while preserving its meaning and tone. Return only the rewritten text, with no preamble, " +
      "explanation, or surrounding quotes.",
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    description: "Construct an optimal prompt from a rough idea.",
    hotkey: "Win+Alt+2",
    builtin: true,
    enabled: true,
    prompt:
      "You are a prompt-engineering assistant. Turn the user's rough idea into a clear, " +
      "well-structured prompt for an AI assistant. Return only the improved prompt, with no " +
      "preamble, explanation, or surrounding quotes.",
  },
];

/** The integrations catalog -- all disconnected until the user connects them. */
const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: "gcal",
    name: "Google Calendar",
    description: "Multi-account calendar access that powers meeting detection.",
    icon: "calendar",
    status: "disconnected",
  },
  {
    id: "api",
    name: "Public API",
    description: "Manage API keys to access notes and transcriptions programmatically.",
    icon: "code",
    status: "disconnected",
  },
  {
    id: "mcp",
    name: "MCP server",
    description: "Connect an AI assistant via the Model Context Protocol. Free.",
    icon: "blocks",
    status: "disconnected",
  },
  {
    id: "cli",
    name: "CLI bridge",
    description: "Local HTTP bridge for unified command-line access. Free.",
    icon: "terminal",
    status: "disconnected",
  },
];

function defaultDoc(): ContentDoc {
  return {
    history: [],
    chat: [],
    chatThreads: [],
    folders: [],
    notes: [],
    uploads: [],
    dictionary: [],
    snippets: [],
    transforms: DEFAULT_TRANSFORMS.map((t) => ({ ...t })),
    integrations: DEFAULT_INTEGRATIONS.map((i) => ({ ...i })),
  };
}

/**
 * Forward-compat: fold any legacy flat chat (messages with no `threadId`) into one "Imported chat"
 * thread so the threaded UI has somewhere to put them. Idempotent (no-op once messages are stamped).
 */
function migrateChat(doc: ContentDoc): ContentDoc {
  const needs = doc.chat.some((m) => !m.threadId);
  if (!needs) return doc;
  const threadId = "thread-imported";
  const first = doc.chat[0];
  const last = doc.chat[doc.chat.length - 1];
  const thread: ChatThread = {
    id: threadId,
    title: "Imported chat",
    createdAt: first?.createdAt ?? "",
    updatedAt: last?.createdAt ?? first?.createdAt ?? "",
    titleStatus: "manual",
  };
  const chat = doc.chat.map((m) => (m.threadId ? m : { ...m, threadId }));
  const chatThreads = doc.chatThreads.some((t) => t.id === threadId)
    ? doc.chatThreads
    : [thread, ...doc.chatThreads];
  return { ...doc, chat, chatThreads };
}

function parse(doc: string | null): ContentDoc {
  const base = defaultDoc();
  if (!doc) return base;
  try {
    const parsed = JSON.parse(doc) as Partial<ContentDoc>;
    return migrateChat({
      history: parsed.history ?? base.history,
      chat: parsed.chat ?? base.chat,
      chatThreads: parsed.chatThreads ?? base.chatThreads,
      folders: parsed.folders ?? base.folders,
      notes: parsed.notes ?? base.notes,
      uploads: parsed.uploads ?? base.uploads,
      dictionary: parsed.dictionary ?? base.dictionary,
      snippets: parsed.snippets ?? base.snippets,
      transforms: parsed.transforms ?? base.transforms,
      integrations: parsed.integrations ?? base.integrations,
    });
  } catch {
    return base;
  }
}

export function createContentStore(io: SettingsIO, deps: ContentDeps): ContentStore {
  const read = (): ContentDoc => parse(io.read());
  const write = (doc: ContentDoc): void => io.write(JSON.stringify(doc));
  return {
    history: () => read().history,
    insights: () => deps.computeInsights(read().history),
    chat: () => read().chat,
    chatThreads: () => read().chatThreads,
    folders: () => read().folders,
    notes: () => read().notes,
    uploads: () => read().uploads,
    dictionary: () => read().dictionary,
    snippets: () => read().snippets,
    transforms: () => read().transforms,
    integrations: () => read().integrations,
    sttModels: () => deps.listModels("stt"),
    llmModels: () => deps.listModels("llm"),
    addHistory: (draft) => {
      const doc = read();
      const words = draft.finalText.trim();
      const entry: HistoryEntry = {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `h-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        finalText: draft.finalText,
        app: draft.app,
        language: draft.language,
        wordCount: words.length > 0 ? words.split(/\s+/).length : 0,
        durationSec: draft.durationSec,
        mode: draft.mode,
        hasAudio: draft.hasAudio,
        cleanupApplied: draft.cleanupApplied,
      };
      doc.history = [entry, ...doc.history];
      // Enforce the privacy retention window (if set): drop entries older than N days.
      const days = deps.retentionDays?.() ?? 0;
      if (days > 0) {
        const cutoff = Date.now() - days * 86_400_000;
        doc.history = doc.history.filter((h) => {
          const t = Date.parse(h.createdAt);
          return Number.isNaN(t) || t >= cutoff;
        });
      }
      write(doc);
      return doc.history;
    },
    replace: (collection, items) => {
      if (!(CONTENT_COLLECTIONS as readonly string[]).includes(collection)) return;
      const doc = read();
      (doc as unknown as Record<string, unknown[]>)[collection] = items;
      write(doc);
    },
  };
}
