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
 * PURE resolver (unit-tested): given a slot's settings + the model catalog + saved connections,
 * produce the display label. A `local` slot resolves the catalog name (falling back to the raw id);
 * any routed slot (providers/self-hosted/enterprise/cloud) resolves the bound connection + the
 * slot's target/deployment override.
 */
export function resolveActiveModel(
  mode: string,
  modelId: string,
  connectionId: string,
  target: string,
  models: ModelInfo[],
  connections: ConnectionProfile[],
): ActiveModel {
  if (mode === "local") {
    const name = models.find((m) => m.id === modelId)?.name ?? modelId;
    return { scope: "Local", model: name || "Not set", isLocal: true };
  }
  const conn = connections.find((c) => c.id === connectionId);
  // A routed slot's model comes from the slot's target override or the connection's default --
  // never the local `modelId` (that belongs to local mode).
  const model = target || conn?.model || "";
  // Prefer the provider kind; fall back to the bound connection's name (so a routed slot still
  // reads clearly before the connections list has loaded), then a generic label.
  const scope = conn?.kind || connectionId || "Cloud";
  return { scope, model: model || "Not set", isLocal: false };
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
    // Re-fetch when the slot's binding changes so a newly-created/bound connection resolves live
    // (the sidebar never unmounts, so a mount-only fetch would stay stale).
  }, [content, connections, kind, mode, connectionId]);

  return resolveActiveModel(mode, modelId, connectionId, target, models, conns);
}
