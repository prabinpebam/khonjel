/** Domain entities surfaced by the content service (mock today, real adapters later). */

export type CaptureMode = "dictation" | "note-recording" | "upload";

export interface HistoryEntry {
  id: string;
  createdAt: string;
  finalText: string;
  app: string;
  language: string;
  wordCount: number;
  durationSec: number;
  mode: CaptureMode;
  hasAudio: boolean;
  cleanupApplied: boolean;
}

export interface InsightsAggregate {
  wpm: number;
  wpmPercentile: number;
  wordsCorrected: number;
  dictionaryFixes: number;
  totalWords: number;
  appUsage: { category: string; count: number; pct: number }[];
  streak: { current: number; longest: number };
  heatmap: { date: string; count: number }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  count: number;
}

export interface Note {
  id: string;
  title: string;
  preview: string;
  body: string;
  folderId: string;
  updatedAt: string;
  fromRecording: boolean;
}

export type UploadState = "queued" | "transcribing" | "done" | "error";

export interface UploadJob {
  id: string;
  filename: string;
  durationSec: number;
  format: string;
  state: UploadState;
  progress: number;
  result?: string;
  error?: string;
}

export type LibraryScope = "personal" | "team";

export interface DictionaryEntry {
  id: string;
  type: "term" | "substitution";
  term?: string;
  trigger?: string;
  replacement?: string;
  scope: LibraryScope;
  source: "manual" | "auto-learn";
}

export interface Snippet {
  id: string;
  trigger: string;
  expansion: string;
  scope: LibraryScope;
}

export interface Transform {
  id: string;
  name: string;
  description: string;
  hotkey: string;
  builtin: boolean;
  enabled: boolean;
}

export type IntegrationStatus = "connected" | "disconnected";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: "calendar" | "code" | "blocks" | "terminal";
  status: IntegrationStatus;
  detail?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  sizeLabel: string;
  recommended: boolean;
}
