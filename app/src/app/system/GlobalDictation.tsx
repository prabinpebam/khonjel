import { useEffect, useRef } from "react";
import { useServices } from "@services";
import { useDictation } from "@hooks/useDictation";

/**
 * Electron-only system controller for global hotkeys (relayed by the preload as "khonjel:hotkey").
 * - "dictation" toggles recording; the cleaned transcript is injected into whatever app had focus.
 * - "transform:<id>" copies the focused app's selection, rewrites it with the transform's prompt
 *   via the LLM, and injects the result in place.
 * Renders nothing. In the browser there is no hotkey bridge, so this is inert.
 */
export function GlobalDictation() {
  const { system, inference, content } = useServices();
  const dictation = useDictation((text) => {
    void system.injectText(text);
  });

  // Keep the latest toggle in a ref so the hotkey subscription is set up once.
  const toggleRef = useRef(dictation.toggle);
  toggleRef.current = dictation.toggle;
  // Guard against overlapping transform runs (a second hotkey press while one is in flight).
  const runningRef = useRef(false);

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.khonjel : undefined;
    if (!bridge?.onHotkey) return;

    const runTransform = async (id: string) => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const transform = (await content.transforms()).find((t) => t.id === id);
        if (!transform) return;
        const selection = (await system.captureSelection()).trim();
        if (selection === "") return;
        const instruction =
          transform.prompt.trim() ||
          `Rewrite the following text. ${transform.name}: ${transform.description}`;
        const { text } = await inference.chat([
          { role: "user", content: `${instruction}\n\n---\n${selection}` },
        ]);
        const result = text.trim();
        if (result !== "") await system.injectText(result);
      } finally {
        runningRef.current = false;
      }
    };

    return bridge.onHotkey((action) => {
      if (action === "dictation") {
        toggleRef.current();
      } else if (action.startsWith("transform:")) {
        void runTransform(action.slice("transform:".length));
      }
    });
  }, [content, inference, system]);

  return null;
}
