// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  resolveSlot,
  isRoutedSlot,
  parseChatReply,
  parseTranscriptReply,
  createProviderRouter,
} from "./router";
import { isIpcError } from "../../shared/ipc-contract";
import type { ConnectionProfile, SettingsSnapshot } from "../../../src/services/ports";

const azureConn: ConnectionProfile = {
  id: "azure-prod",
  kind: "azure-openai",
  baseEndpoint: "https://res.cognitiveservices.azure.com",
  apiVersion: "2025-03-01-preview",
  authMode: "bearer-token",
};

function settings(values: Record<string, string>): SettingsSnapshot {
  return { toggles: {}, values };
}

describe("resolveSlot / isRoutedSlot", () => {
  it("defaults to local + unbound", () => {
    const slot = resolveSlot({}, "llm.cleanup");
    expect(slot.mode).toBe("local");
    expect(isRoutedSlot(slot)).toBe(false);
  });

  it("routes when an enterprise slot binds a connection", () => {
    const slot = resolveSlot(
      {
        "llm.chat.mode": "enterprise",
        "llm.chat.connectionId": "azure-prod",
        "llm.chat.target": "gpt-5.4",
      },
      "llm.chat",
    );
    expect(isRoutedSlot(slot)).toBe(true);
    expect(slot.target).toBe("gpt-5.4");
  });

  it("does not route an enterprise slot with no connection bound", () => {
    expect(isRoutedSlot({ mode: "enterprise" })).toBe(false);
  });
});

describe("parse helpers", () => {
  it("parseChatReply extracts + trims content", () => {
    expect(parseChatReply({ choices: [{ message: { content: "  hi " } }] })).toBe("hi");
  });

  it("parseTranscriptReply extracts + trims text", () => {
    expect(parseTranscriptReply({ text: " hello " })).toBe("hello");
  });
});

describe("createProviderRouter", () => {
  const base = {
    getConnection: (id: string) => (id === "azure-prod" ? azureConn : undefined),
    getSecret: () => "SECRET",
  };

  it("returns undefined for a local slot (caller falls back to local)", async () => {
    const router = createProviderRouter({
      ...base,
      getSettings: () => settings({}),
      fetch: { json: async () => ({}), transcription: async () => ({}) },
    });
    expect(await router.completeForSlot("llm.cleanup", [])).toBeUndefined();
  });

  it("routes a bound Azure chat slot to the correct Azure URL", async () => {
    let url = "";
    const router = createProviderRouter({
      ...base,
      getSettings: () =>
        settings({
          "llm.chat.mode": "enterprise",
          "llm.chat.connectionId": "azure-prod",
          "llm.chat.target": "gpt-5.4",
        }),
      fetch: {
        json: async (req) => {
          url = req.url;
          return { choices: [{ message: { content: "Paris" } }] };
        },
        transcription: async () => ({}),
      },
    });
    expect(await router.completeForSlot("llm.chat", [{ role: "user", content: "hi" }])).toBe("Paris");
    expect(url).toBe(
      "https://res.cognitiveservices.azure.com/openai/deployments/gpt-5.4/chat/completions?api-version=2025-03-01-preview",
    );
  });

  it("routes a bound Azure STT slot to the transcription URL", async () => {
    let url = "";
    const router = createProviderRouter({
      ...base,
      getSettings: () =>
        settings({
          "stt.dictation.mode": "enterprise",
          "stt.dictation.connectionId": "azure-prod",
          "stt.dictation.target": "gpt-4o-transcribe",
        }),
      fetch: {
        json: async () => ({}),
        transcription: async (req) => {
          url = req.url;
          return { text: "transcribed" };
        },
      },
    });
    expect(await router.transcribeForSlot("stt.dictation", new Uint8Array([1, 2, 3]), { language: "en" })).toBe(
      "transcribed",
    );
    expect(url).toContain("/openai/deployments/gpt-4o-transcribe/audio/transcriptions?api-version=");
  });

  it("wraps provider failures as an IpcError(provider_error)", async () => {
    const router = createProviderRouter({
      ...base,
      getSettings: () =>
        settings({
          "llm.chat.mode": "providers",
          "llm.chat.connectionId": "azure-prod",
          "llm.chat.target": "x",
        }),
      fetch: {
        json: async () => {
          throw new Error("boom 500");
        },
        transcription: async () => ({}),
      },
    });
    await expect(router.completeForSlot("llm.chat", [])).rejects.toSatisfy(
      (e: unknown) => isIpcError(e) && e.code === "provider_error",
    );
  });
});

describe("createProviderRouter — streamForSlot", () => {
  const base = {
    getConnection: (id: string) => (id === "azure-prod" ? azureConn : undefined),
    getSecret: () => "SECRET",
  };
  const sse = (chunks: string[]) => ({
    ok: true,
    status: 200,
    text: async () => "",
    body: (async function* () {
      const enc = new TextEncoder();
      for (const c of chunks) yield enc.encode(c);
    })(),
  });
  const boundChat = {
    "llm.chat.mode": "providers",
    "llm.chat.connectionId": "azure-prod",
    "llm.chat.target": "x",
  };

  it("streams deltas for a bound chat slot, returns true, and sets stream:true", async () => {
    let sentBody: Record<string, unknown> = {};
    const router = createProviderRouter({
      ...base,
      getSettings: () => settings(boundChat),
      fetch: {
        json: async () => ({}),
        transcription: async () => ({}),
        stream: async (req) => {
          sentBody = req.body as Record<string, unknown>;
          return sse([
            'data: {"choices":[{"delta":{"content":"He"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n',
            "data: [DONE]\n\n",
          ]);
        },
      },
    });
    const tokens: string[] = [];
    const handled = await router.streamForSlot(
      "llm.chat",
      [{ role: "user", content: "hi" }],
      { onToken: (d) => tokens.push(d) },
    );
    expect(handled).toBe(true);
    expect(tokens.join("")).toBe("Hello");
    expect(sentBody.stream).toBe(true);
  });

  it("returns false for a local/unbound slot (caller falls back to local)", async () => {
    const router = createProviderRouter({
      ...base,
      getSettings: () => settings({}),
      fetch: { json: async () => ({}), transcription: async () => ({}), stream: async () => sse([]) },
    });
    expect(await router.streamForSlot("llm.chat", [], { onToken: () => undefined })).toBe(false);
  });

  it("wraps a cloud stream failure as IpcError(provider_error)", async () => {
    const router = createProviderRouter({
      ...base,
      getSettings: () => settings(boundChat),
      fetch: {
        json: async () => ({}),
        transcription: async () => ({}),
        stream: async () => {
          throw new Error("net down");
        },
      },
    });
    await expect(router.streamForSlot("llm.chat", [], { onToken: () => undefined })).rejects.toSatisfy(
      (e: unknown) => isIpcError(e) && e.code === "provider_error",
    );
  });
});
