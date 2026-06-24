import { describe, it, expect, vi } from "vitest";
import { createLogger, shouldLog, formatLogLine } from "./logger";

describe("shouldLog", () => {
  it("info verbosity shows error/warn/info but hides debug/trace", () => {
    expect(shouldLog("info", "error")).toBe(true);
    expect(shouldLog("info", "warn")).toBe(true);
    expect(shouldLog("info", "info")).toBe(true);
    expect(shouldLog("info", "debug")).toBe(false);
    expect(shouldLog("info", "trace")).toBe(false);
  });

  it("debug verbosity adds debug but still hides trace", () => {
    expect(shouldLog("debug", "debug")).toBe(true);
    expect(shouldLog("debug", "trace")).toBe(false);
  });

  it("trace verbosity shows everything", () => {
    expect(shouldLog("trace", "trace")).toBe(true);
    expect(shouldLog("trace", "debug")).toBe(true);
    expect(shouldLog("trace", "info")).toBe(true);
  });

  it("an unknown verbosity falls back to info", () => {
    expect(shouldLog("bogus", "info")).toBe(true);
    expect(shouldLog("bogus", "debug")).toBe(false);
  });
});

describe("formatLogLine", () => {
  it("renders an ISO timestamp, padded level, and message", () => {
    const line = formatLogLine(new Date("2026-06-24T12:00:00.000Z"), "info", "ready");
    expect(line).toBe("2026-06-24T12:00:00.000Z INFO  ready");
  });
});

describe("createLogger", () => {
  function harness(level: string) {
    const appended: { file: string; data: string }[] = [];
    const mkdirSync = vi.fn();
    const appendFileSync = vi.fn((file: string, data: string) => {
      appended.push({ file, data });
    });
    const logger = createLogger({
      dir: () => "/logs",
      level: () => level,
      fs: { mkdirSync, appendFileSync },
      now: () => new Date("2026-06-24T12:00:00.000Z"),
    });
    return { logger, appended, mkdirSync, appendFileSync };
  }

  it("writes a line at or below the configured level and skips quieter ones", () => {
    const h = harness("info");
    h.logger.info("up");
    h.logger.debug("down");
    expect(h.appended).toHaveLength(1);
    expect(h.appended[0]?.data).toContain("INFO  up");
    expect(h.mkdirSync).toHaveBeenCalledWith("/logs", { recursive: true });
  });

  it("emits debug + trace when verbosity is raised to trace", () => {
    const h = harness("trace");
    h.logger.debug("d");
    h.logger.trace("t");
    expect(h.appended).toHaveLength(2);
  });

  it("appends to the log file with a trailing newline", () => {
    const h = harness("info");
    h.logger.warn("careful");
    expect(h.appended[0]?.file).toContain("khonjel-main.log");
    expect(h.appended[0]?.data.endsWith("\n")).toBe(true);
  });

  it("never throws if the filesystem fails", () => {
    const logger = createLogger({
      dir: () => "/logs",
      level: () => "info",
      fs: {
        mkdirSync: () => {
          throw new Error("eperm");
        },
        appendFileSync: () => {
          throw new Error("eperm");
        },
      },
    });
    expect(() => logger.info("still ok")).not.toThrow();
  });

  it("mirrors emitted lines to the optional sink, gated by level", () => {
    const mirror = vi.fn();
    const logger = createLogger({
      dir: () => "/logs",
      level: () => "info",
      fs: { mkdirSync: vi.fn(), appendFileSync: vi.fn() },
      mirror,
    });
    logger.info("seen");
    logger.debug("hidden");
    expect(mirror).toHaveBeenCalledTimes(1);
    expect(mirror).toHaveBeenCalledWith("info", expect.stringContaining("seen"));
  });
});
