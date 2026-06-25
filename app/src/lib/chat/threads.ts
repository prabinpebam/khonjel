import type { ChatThread } from "@services/ports";

/** A best-effort unique id (crypto.randomUUID when available, else a timestamped fallback). */
export function newId(prefix: string): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/** Create a new (draft) thread. The caller persists it on the first send. */
export function createThread(now: string, id = newId("t")): ChatThread {
  return { id, title: "", createdAt: now, updatedAt: now, titleStatus: "pending" };
}

/** Rename a thread; a manual rename is sticky (titleStatus -> manual) and never auto-overwritten. */
export function renameThread(threads: ChatThread[], id: string, title: string): ChatThread[] {
  return threads.map((t) =>
    t.id === id ? { ...t, title: title.trim(), titleStatus: "manual" } : t,
  );
}

/** Apply an auto-generated title unless the thread was manually titled. */
export function autoTitleThread(threads: ChatThread[], id: string, title: string): ChatThread[] {
  return threads.map((t) =>
    t.id === id && t.titleStatus !== "manual"
      ? { ...t, title: title.trim(), titleStatus: "auto" }
      : t,
  );
}

/** Bump `updatedAt` so the thread sorts to the top of the most-recent-first list. */
export function touchThread(threads: ChatThread[], id: string, now: string): ChatThread[] {
  return threads.map((t) => (t.id === id ? { ...t, updatedAt: now } : t));
}

/** Most-recent-first by `updatedAt` (stable for equal timestamps). */
export function sortThreads(threads: ChatThread[]): ChatThread[] {
  return [...threads].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0,
  );
}

/** Remove a thread; returns the remaining threads + the next thread to select (newest), or null. */
export function deleteThread(
  threads: ChatThread[],
  id: string,
): { threads: ChatThread[]; nextId: string | null } {
  const remaining = threads.filter((t) => t.id !== id);
  return { threads: remaining, nextId: sortThreads(remaining)[0]?.id ?? null };
}
