import { describe, it, expect } from "vitest";
import {
  createThread,
  renameThread,
  autoTitleThread,
  touchThread,
  sortThreads,
  deleteThread,
} from "./threads";
import type { ChatThread } from "@services/ports";

function thread(id: string, updatedAt: string, over: Partial<ChatThread> = {}): ChatThread {
  return { id, title: id, createdAt: updatedAt, updatedAt, titleStatus: "auto", ...over };
}

describe("createThread", () => {
  it("starts empty + pending", () => {
    expect(createThread("2026-01-01T00:00:00Z", "t1")).toEqual({
      id: "t1",
      title: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      titleStatus: "pending",
    });
  });
});

describe("renameThread", () => {
  it("sets a trimmed title and marks it manual", () => {
    const out = renameThread([thread("t1", "a")], "t1", "  My chat  ");
    expect(out[0]?.title).toBe("My chat");
    expect(out[0]?.titleStatus).toBe("manual");
  });
});

describe("autoTitleThread", () => {
  it("applies an auto title to a non-manual thread", () => {
    const out = autoTitleThread([thread("t1", "a", { titleStatus: "pending" })], "t1", "Hello there");
    expect(out[0]?.title).toBe("Hello there");
    expect(out[0]?.titleStatus).toBe("auto");
  });
  it("never overwrites a manual title", () => {
    const out = autoTitleThread([thread("t1", "a", { title: "Mine", titleStatus: "manual" })], "t1", "Auto");
    expect(out[0]?.title).toBe("Mine");
    expect(out[0]?.titleStatus).toBe("manual");
  });
});

describe("touchThread + sortThreads", () => {
  it("bumps updatedAt so the thread sorts to the top", () => {
    let threads = [thread("a", "2026-01-01T00:00:00Z"), thread("b", "2026-01-02T00:00:00Z")];
    threads = touchThread(threads, "a", "2026-01-03T00:00:00Z");
    expect(sortThreads(threads).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("deleteThread", () => {
  it("removes the thread and reselects the newest remaining", () => {
    const threads = [
      thread("a", "2026-01-01T00:00:00Z"),
      thread("b", "2026-01-02T00:00:00Z"),
      thread("c", "2026-01-03T00:00:00Z"),
    ];
    const out = deleteThread(threads, "c");
    expect(out.threads.map((t) => t.id)).toEqual(["a", "b"]);
    expect(out.nextId).toBe("b");
  });
  it("returns a null next id when nothing remains", () => {
    expect(deleteThread([thread("a", "x")], "a").nextId).toBeNull();
  });
});
