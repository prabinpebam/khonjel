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
