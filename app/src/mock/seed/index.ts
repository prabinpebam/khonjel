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
} from "@services/ports";

export const HISTORY: HistoryEntry[] = [
  {
    id: "h1",
    createdAt: "2026-06-20T09:12:00",
    finalText:
      "Let's ship the mock frontend first, then wire the real adapters behind the same ports. The seam keeps the UI untouched.",
    app: "Slack",
    language: "en-US",
    wordCount: 22,
    durationSec: 9,
    mode: "dictation",
    hasAudio: true,
    cleanupApplied: true,
  },
  {
    id: "h2",
    createdAt: "2026-06-20T08:40:00",
    finalText:
      "Reminder: the floating bar must be theme-aware and respect reduced motion. Waveform becomes a static meter.",
    app: "Email",
    language: "en-US",
    wordCount: 17,
    durationSec: 7,
    mode: "dictation",
    hasAudio: false,
    cleanupApplied: true,
  },
  {
    id: "h3",
    createdAt: "2026-06-19T16:05:00",
    finalText:
      "Design review notes: keep the greige canvas, the white floating panel, and the violet accent for interactive state only.",
    app: "Word",
    language: "en-US",
    wordCount: 19,
    durationSec: 8,
    mode: "note-recording",
    hasAudio: true,
    cleanupApplied: true,
  },
  {
    id: "h4",
    createdAt: "2026-06-19T11:22:00",
    finalText:
      "The quarterly plan looks solid. Let's lock the privacy defaults to everything off and document the retention controls.",
    app: "Notion",
    language: "en-US",
    wordCount: 18,
    durationSec: 8,
    mode: "dictation",
    hasAudio: false,
    cleanupApplied: false,
  },
  {
    id: "h5",
    createdAt: "2026-06-18T14:48:00",
    finalText:
      "Transcribe the kickoff recording and save it as a note in the Meetings folder with speaker labels.",
    app: "Khonjel",
    language: "en-US",
    wordCount: 16,
    durationSec: 6,
    mode: "upload",
    hasAudio: true,
    cleanupApplied: true,
  },
];

export const INSIGHTS: InsightsAggregate = {
  wpm: 140,
  wpmPercentile: 99.8,
  wordsCorrected: 27,
  dictionaryFixes: 34,
  totalWords: 3599,
  appUsage: [
    { category: "AI prompts", count: 161, pct: 93 },
    { category: "Work emails", count: 48, pct: 64 },
    { category: "Personal messages", count: 31, pct: 42 },
    { category: "Documents", count: 22, pct: 28 },
    { category: "Other tasks", count: 23, pct: 7 },
  ],
  streak: { current: 1, longest: 3 },
  heatmap: buildHeatmap(),
};

function buildHeatmap(): { date: string; count: number }[] {
  const WEEKS = 17;
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Anchor to a fixed recent Saturday so the calendar is deterministic (mock data).
  const end = new Date(2026, 5, 20);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(end.getDate() - (WEEKS * 7 - 1));
  const cells: { date: string; count: number }[] = [];
  let i = 0;
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const noise = Math.sin((i + 1) * 12.9898) * 43758.5453;
    const r = Math.floor((noise - Math.floor(noise)) * 100);
    let count = 0;
    if (r >= 97) count = 4;
    else if (r >= 94) count = 3;
    else if (r >= 90) count = 2;
    else if (r >= 85) count = 1;
    cells.push({ date: fmt(day), count });
    i += 1;
  }
  return cells;
}

export const CHAT: ChatMessage[] = [
  {
    id: "c1",
    role: "user",
    content: "Summarize my design review note into three bullet points.",
    createdAt: "2026-06-20T09:30:00",
  },
  {
    id: "c2",
    role: "assistant",
    content:
      "Here are the key points:\n\n- Keep the greige canvas with the white floating panel.\n- Use the violet accent only for interactive state.\n- Charts use teal exclusively.",
    createdAt: "2026-06-20T09:30:04",
  },
  {
    id: "c3",
    role: "user",
    content: "Now rewrite it as a one-line commit message.",
    createdAt: "2026-06-20T09:31:00",
  },
  {
    id: "c4",
    role: "assistant",
    content: "`docs: lock design language — greige canvas, violet accent for state, teal charts`",
    createdAt: "2026-06-20T09:31:03",
  },
];

export const FOLDERS: Folder[] = [
  { id: "all", name: "All notes", count: 6 },
  { id: "meetings", name: "Meetings", count: 2 },
  { id: "ideas", name: "Ideas", count: 2 },
  { id: "personal", name: "Personal", count: 2 },
];

export const NOTES: Note[] = [
  {
    id: "n1",
    title: "Kickoff meeting — Khonjel",
    preview: "Goals, scope, and the local-first principle. Action items assigned to the design and platform tracks.",
    body: "## Goals\n\n- Ship the mock frontend first.\n- Keep everything on-device by default.\n\n## Action items\n\n- [ ] Lock the design tokens.\n- [ ] Wire the services seam.",
    folderId: "meetings",
    updatedAt: "2026-06-20T10:02:00",
    fromRecording: true,
  },
  {
    id: "n2",
    title: "Design language decisions",
    preview: "Greige canvas, white floating panel, violet accent for interactive state, teal for charts only.",
    body: "Greige canvas (#f2f1ee), white surface, violet accent for state, teal for data only. Radius 8/12/16/pill.",
    folderId: "ideas",
    updatedAt: "2026-06-19T16:20:00",
    fromRecording: false,
  },
  {
    id: "n3",
    title: "Privacy defaults",
    preview: "Everything off by default. Local retention controls. Privacy mode disables any training signal.",
    body: "Everything off by default. Audio retention selectable 0-90 days. Privacy mode = no training.",
    folderId: "ideas",
    updatedAt: "2026-06-19T12:00:00",
    fromRecording: false,
  },
  {
    id: "n4",
    title: "Weekly review",
    preview: "Shipped the shell and the eval loop. Next: complete every view and package the portable app.",
    body: "Shipped: shell + eval loop. Next: all views + Electron portable.",
    folderId: "personal",
    updatedAt: "2026-06-18T18:30:00",
    fromRecording: false,
  },
  {
    id: "n5",
    title: "Standup — platform",
    preview: "Adapters behind ports. Mock now, Electron IPC later. Zero UI change at the swap.",
    body: "Adapters behind ports. Mock now, Electron IPC later.",
    folderId: "meetings",
    updatedAt: "2026-06-18T09:15:00",
    fromRecording: true,
  },
  {
    id: "n6",
    title: "Grocery list",
    preview: "Coffee, oats, olive oil, and a new notebook for sketches.",
    body: "Coffee, oats, olive oil, notebook.",
    folderId: "personal",
    updatedAt: "2026-06-17T20:05:00",
    fromRecording: false,
  },
];

export const UPLOADS: UploadJob[] = [
  {
    id: "u1",
    filename: "kickoff-call.mp3",
    durationSec: 1820,
    format: "mp3",
    state: "done",
    progress: 100,
    result:
      "Alex: Let's start with the high-level goals. You: Sounds good, the timeline is tight but achievable.",
  },
  {
    id: "u2",
    filename: "voice-memo-042.wav",
    durationSec: 95,
    format: "wav",
    state: "transcribing",
    progress: 62,
  },
  {
    id: "u3",
    filename: "interview-raw.m4a",
    durationSec: 2640,
    format: "m4a",
    state: "queued",
    progress: 0,
  },
];

export const DICTIONARY: DictionaryEntry[] = [
  { id: "d1", type: "term", term: "Khonjel", scope: "personal", source: "manual" },
  { id: "d2", type: "term", term: "Parakeet", scope: "personal", source: "auto-learn" },
  { id: "d3", type: "substitution", trigger: "stt", replacement: "speech-to-text", scope: "personal", source: "manual" },
  { id: "d4", type: "substitution", trigger: "llm", replacement: "language model", scope: "team", source: "manual" },
  { id: "d5", type: "term", term: "diarization", scope: "team", source: "manual" },
  { id: "d6", type: "substitution", trigger: "wpm", replacement: "words per minute", scope: "personal", source: "auto-learn" },
];

export const SNIPPETS: Snippet[] = [
  { id: "s1", trigger: "/sig", expansion: "Best regards,\nPrabin", scope: "personal" },
  { id: "s2", trigger: "/addr", expansion: "Khonjel HQ, Imphal, Manipur", scope: "personal" },
  { id: "s3", trigger: "/standup", expansion: "Yesterday:\nToday:\nBlockers:", scope: "team" },
];

export const TRANSFORMS: Transform[] = [
  {
    id: "t1",
    name: "Polish",
    description: "Improve clarity and conciseness.",
    hotkey: "Win+Alt+1",
    builtin: true,
    enabled: true,
  },
  {
    id: "t2",
    name: "Prompt Engineer",
    description: "Construct an optimal prompt from a rough idea.",
    hotkey: "Win+Alt+2",
    builtin: true,
    enabled: true,
  },
  {
    id: "t3",
    name: "Formalize",
    description: "Rewrite casual text in a professional tone.",
    hotkey: "Win+Alt+3",
    builtin: false,
    enabled: true,
  },
  {
    id: "t4",
    name: "Summarize",
    description: "Condense long text into key points.",
    hotkey: "Win+Alt+4",
    builtin: false,
    enabled: false,
  },
];

export const INTEGRATIONS: Integration[] = [
  {
    id: "gcal",
    name: "Google Calendar",
    description: "Multi-account calendar access that powers meeting detection.",
    icon: "calendar",
    status: "connected",
    detail: "you@example.com",
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
    status: "connected",
    detail: "http://localhost:3001",
  },
];

export const STT_MODELS: ModelInfo[] = [
  { id: "whisper-large-v3", name: "Whisper Large v3", sizeLabel: "1.5 GB", recommended: true },
  { id: "whisper-medium", name: "Whisper Medium", sizeLabel: "769 MB", recommended: false },
  { id: "whisper-base", name: "Whisper Base", sizeLabel: "142 MB", recommended: false },
  { id: "parakeet-tdt", name: "NVIDIA Parakeet TDT", sizeLabel: "1.1 GB", recommended: false },
];

export const LLM_MODELS: ModelInfo[] = [
  { id: "qwen-3.5-4b", name: "Qwen 3.5 4B", sizeLabel: "2.4 GB", recommended: true },
  { id: "llama-3.3-8b", name: "Llama 3.3 8B", sizeLabel: "4.7 GB", recommended: false },
  { id: "phi-4-mini", name: "Phi-4 Mini", sizeLabel: "2.2 GB", recommended: false },
];
