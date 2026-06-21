import { useEffect, useRef } from "react";
import { useServices } from "@services";
import { useDictation } from "@hooks/useDictation";

/**
 * Electron-only system controller: the global dictation hotkey (relayed by the preload as
 * "khonjel:hotkey") toggles recording; the cleaned transcript is injected into whatever app had
 * focus via system.injectText. Renders nothing. In the browser there is no hotkey bridge, so this
 * is inert.
 */
export function GlobalDictation() {
  const { system } = useServices();
  const dictation = useDictation((text) => {
    void system.injectText(text);
  });

  // Keep the latest toggle in a ref so the hotkey subscription is set up once.
  const toggleRef = useRef(dictation.toggle);
  toggleRef.current = dictation.toggle;

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.khonjel : undefined;
    if (!bridge?.onHotkey) return;
    return bridge.onHotkey((action) => {
      if (action === "dictation") toggleRef.current();
    });
  }, []);

  return null;
}
