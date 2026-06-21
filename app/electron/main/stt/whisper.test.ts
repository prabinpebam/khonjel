// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildWhisperArgs, parseWhisperText, createWhisperTranscriber } from "./whisper";

describe("buildWhisperArgs", () => {
  it("builds a timestamp-free transcript command with model + audio + language", () => {
    const args = buildWhisperArgs({ modelPath: "/m.bin", audioPath: "/a.wav", language: "en" });
    expect(args[args.indexOf("-m") + 1]).toBe("/m.bin");
    expect(args[args.indexOf("-f") + 1]).toBe("/a.wav");
    expect(args[args.indexOf("-l") + 1]).toBe("en");
    expect(args).toContain("-nt");
    expect(args).toContain("-np");
  });

  it("defaults language to auto and adds -tr only when translating", () => {
    expect(buildWhisperArgs({ modelPath: "m", audioPath: "a" })[
      buildWhisperArgs({ modelPath: "m", audioPath: "a" }).indexOf("-l") + 1
    ]).toBe("auto");
    expect(buildWhisperArgs({ modelPath: "m", audioPath: "a", translate: true })).toContain("-tr");
    expect(buildWhisperArgs({ modelPath: "m", audioPath: "a" })).not.toContain("-tr");
  });
});

describe("parseWhisperText", () => {
  it("joins segment lines and strips stray timestamps", () => {
    const out = parseWhisperText("[00:00:00.000 --> 00:00:02.000]  Hello there.\n  And welcome.\n");
    expect(out).toBe("Hello there. And welcome.");
  });

  it("returns empty string for blank output", () => {
    expect(parseWhisperText("\n  \n")).toBe("");
  });
});

describe("createWhisperTranscriber", () => {
  it("runs whisper-cli and returns the parsed transcript", async () => {
    let calledBin = "";
    let calledArgs: string[] = [];
    const transcriber = createWhisperTranscriber({
      binPath: "/bin/whisper-cli",
      modelPath: "/m.bin",
      run: async (bin, args) => {
        calledBin = bin;
        calledArgs = args;
        return "  This is a test.  ";
      },
    });
    const text = await transcriber.transcribe("/clip.wav", { language: "en" });
    expect(text).toBe("This is a test.");
    expect(calledBin).toBe("/bin/whisper-cli");
    expect(calledArgs[calledArgs.indexOf("-f") + 1]).toBe("/clip.wav");
    expect(calledArgs[calledArgs.indexOf("-l") + 1]).toBe("en");
  });
});
