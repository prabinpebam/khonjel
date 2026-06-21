import { useEffect, useState } from "react";
import { useServices } from "@services";
import { useSettingsStore } from "@stores/settings";
import type { ConnectionProfile, ModelInfo } from "@services/ports";

export interface ActiveModel {
  /** "Local" for on-device, otherwise the connection/provider name. */
  scope: string;
  /** Display name of the model or deployment. */
  model: string;
  /** True when the slot runs on the local engine. */
  isLocal: boolean;
}

/**
 * Resolves a routing slot (e.g. "llm.chat", "stt.dictation") to a human label by combining the
 * live settings with the model catalog and saved connections. Used by the chat badge and the
 * sidebar engine-status card so they reflect the user's actual configuration instead of a
 * hardcoded model name.
 */
export function useActiveModel(prefix: string, kind: "llm" | "stt"): ActiveModel {
  const { content, connections } = useServices();
  const mode = useSettingsStore((s) => s.values[`${prefix}.mode`] ?? "local");
  const modelId = useSettingsStore((s) => s.values[`${prefix}.model`] ?? "");
  const connectionId = useSettingsStore((s) => s.values[`${prefix}.connectionId`] ?? "");
  const target = useSettingsStore((s) => s.values[`${prefix}.target`] ?? "");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [conns, setConns] = useState<ConnectionProfile[]>([]);

  useEffect(() => {
    let live = true;
    const loadModels = kind === "llm" ? content.llmModels() : content.sttModels();
    void Promise.all([loadModels, connections.list()]).then(([m, c]) => {
      if (!live) return;
      setModels(m);
      setConns(c);
    });
    return () => {
      live = false;
    };
  }, [content, connections, kind]);

  if (mode === "local") {
    const name = models.find((m) => m.id === modelId)?.name ?? modelId;
    return { scope: "Local", model: name || "Not set", isLocal: true };
  }
  const conn = conns.find((c) => c.id === connectionId);
  const model = target || conn?.model || modelId;
  return { scope: conn?.kind ?? "Cloud", model: model || "Not set", isLocal: false };
}
