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
  DictionaryEntry,
  Folder,
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
}

export interface ContentStore {
  history: () => HistoryEntry[];
  insights: () => InsightsAggregate;
  chat: () => ChatMessage[];
  folders: () => Folder[];
  notes: () => Note[];
  uploads: () => UploadJob[];
  dictionary: () => DictionaryEntry[];
  snippets: () => Snippet[];
  transforms: () => Transform[];
  integrations: () => Integration[];
  sttModels: () => ModelInfo[];
  llmModels: () => ModelInfo[];
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
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    description: "Construct an optimal prompt from a rough idea.",
    hotkey: "Win+Alt+2",
    builtin: true,
    enabled: true,
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
    folders: [],
    notes: [],
    uploads: [],
    dictionary: [],
    snippets: [],
    transforms: DEFAULT_TRANSFORMS.map((t) => ({ ...t })),
    integrations: DEFAULT_INTEGRATIONS.map((i) => ({ ...i })),
  };
}

function parse(doc: string | null): ContentDoc {
  const base = defaultDoc();
  if (!doc) return base;
  try {
    const parsed = JSON.parse(doc) as Partial<ContentDoc>;
    return {
      history: parsed.history ?? base.history,
      chat: parsed.chat ?? base.chat,
      folders: parsed.folders ?? base.folders,
      notes: parsed.notes ?? base.notes,
      uploads: parsed.uploads ?? base.uploads,
      dictionary: parsed.dictionary ?? base.dictionary,
      snippets: parsed.snippets ?? base.snippets,
      transforms: parsed.transforms ?? base.transforms,
      integrations: parsed.integrations ?? base.integrations,
    };
  } catch {
    return base;
  }
}

export function createContentStore(io: SettingsIO, deps: ContentDeps): ContentStore {
  const read = (): ContentDoc => parse(io.read());
  return {
    history: () => read().history,
    insights: () => deps.computeInsights(read().history),
    chat: () => read().chat,
    folders: () => read().folders,
    notes: () => read().notes,
    uploads: () => read().uploads,
    dictionary: () => read().dictionary,
    snippets: () => read().snippets,
    transforms: () => read().transforms,
    integrations: () => read().integrations,
    sttModels: () => deps.listModels("stt"),
    llmModels: () => deps.listModels("llm"),
  };
}
