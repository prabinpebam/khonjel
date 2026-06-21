import { describe, it, expect } from "vitest";
import { formatDuration, formatRelative } from "./format";

/** L2 unit example — pure presentation logic. Mirrors the TDD lane for backend pure functions. */
describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("rolls up into hours and minutes past an hour", () => {
    expect(formatDuration(3 * 3600 + 25 * 60)).toBe("3h 25m");
  });
});

describe("formatRelative", () => {
  it("labels the current instant as Today", () => {
    expect(formatRelative(new Date().toISOString())).toBe("Today");
  });

  it("labels ~24h ago as Yesterday", () => {
    const aboutADayAgo = new Date(Date.now() - 86_400_000 - 1000).toISOString();
    expect(formatRelative(aboutADayAgo)).toBe("Yesterday");
  });
});
