// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildSherpaArgs,
  buildSherpaServerArgs,
  parseSherpaText,
  createParakeetTranscriber,
  type ParakeetModelDir,
} from "./parakeet";

const MODEL: ParakeetModelDir = {
  encoder: "/m/encoder.int8.onnx",
  decoder: "/m/decoder.int8.onnx",
  joiner: "/m/joiner.int8.onnx",
  tokens: "/m/tokens.txt",
};

describe("buildSherpaArgs", () => {
  it("builds the sherpa-onnx-offline argv with model parts, model-type, and the wav last", () => {
    const args = buildSherpaArgs({ model: MODEL, audioPath: "/clip.wav", numThreads: 4 });
    expect(args).toContain("--encoder=/m/encoder.int8.onnx");
    expect(args).toContain("--decoder=/m/decoder.int8.onnx");
    expect(args).toContain("--joiner=/m/joiner.int8.onnx");
    expect(args).toContain("--tokens=/m/tokens.txt");
    expect(args).toContain("--model-type=nemo_transducer");
    expect(args).toContain("--num-threads=4");
    // The audio path is the final positional argument.
    expect(args[args.length - 1]).toBe("/clip.wav");
  });

  it("defaults the provider to cpu and honors cuda when requested", () => {
    expect(buildSherpaArgs({ model: MODEL, audioPath: "/a.wav" })).toContain("--provider=cpu");
    expect(buildSherpaArgs({ model: MODEL, audioPath: "/a.wav", provider: "cuda" })).toContain(
      "--provider=cuda",
    );
  });

  it("omits --num-threads when not specified", () => {
    const args = buildSherpaArgs({ model: MODEL, audioPath: "/a.wav" });
    expect(args.some((a) => a.startsWith("--num-threads="))).toBe(false);
  });
});

describe("buildSherpaServerArgs", () => {
  it("builds the websocket-server argv with model parts + --port and NO audio path", () => {
    const args = buildSherpaServerArgs({ model: MODEL, port: 6066, numThreads: 2 });
    expect(args).toContain("--encoder=/m/encoder.int8.onnx");
    expect(args).toContain("--decoder=/m/decoder.int8.onnx");
    expect(args).toContain("--joiner=/m/joiner.int8.onnx");
    expect(args).toContain("--tokens=/m/tokens.txt");
    expect(args).toContain("--model-type=nemo_transducer");
    expect(args).toContain("--num-threads=2");
    expect(args).toContain("--port=6066");
    // No positional .wav for the persistent server.
    expect(args.some((a) => a.endsWith(".wav"))).toBe(false);
  });

  it("defaults the provider to cpu", () => {
    expect(buildSherpaServerArgs({ model: MODEL, port: 1 })).toContain("--provider=cpu");
  });
});

describe("parseSherpaText", () => {
  it("finds the JSON object with a text field amid config/log lines and trims it", () => {
    const stdout = [
      "/path/to/sherpa-onnx-offline --encoder=...",
      "OfflineRecognizerConfig(feat_config=...)",
      "Started",
      '{"lang":"","emotion":"","event":"","text":" Ask not what your country can do for you.","timestamps":[0.1,0.2],"tokens":["a","b"],"words":[]}',
      "Done",
      "Elapsed seconds: 0.42",
    ].join("\n");
    expect(parseSherpaText(stdout)).toBe("Ask not what your country can do for you.");
  });

  it("returns an empty string when no JSON transcript line is present", () => {
    expect(parseSherpaText("just logs\nno json here\n")).toBe("");
  });

  it("ignores JSON objects that have no text field", () => {
    expect(parseSherpaText('{"status":"ok"}\n{"foo":1}\n')).toBe("");
  });
});

describe("createParakeetTranscriber", () => {
  it("runs sherpa-onnx-offline and returns the parsed transcript", async () => {
    let calledBin = "";
    let calledArgs: string[] = [];
    const transcriber = createParakeetTranscriber({
      binPath: "/bin/sherpa-onnx-offline",
      model: MODEL,
      numThreads: 8,
      run: async (bin, args) => {
        calledBin = bin;
        calledArgs = args;
        return '{"text":"  hello world  "}';
      },
    });
    const text = await transcriber.transcribe("/clip.wav");
    expect(text).toBe("hello world");
    expect(calledBin).toBe("/bin/sherpa-onnx-offline");
    expect(calledArgs[calledArgs.length - 1]).toBe("/clip.wav");
    expect(calledArgs).toContain("--num-threads=8");
  });
});
