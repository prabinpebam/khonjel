/**
 * Text injector: routes cleaned dictation text into the focused app using the per-app strategy
 * from ./table.ts. The OS bindings (clipboard write, paste keystroke, char typing, foreground-app
 * lookup) are INJECTED, so the routing logic is BE1-tested without touching the OS; the composition
 * root supplies the real win32 bindings (./win32.ts).
 */
import { selectInjectionStrategy, type InjectionStrategy, type InjectionTable } from "./table";

export interface InjectorDeps {
  writeClipboard: (text: string) => void;
  /** Send Ctrl+V to the foreground window. */
  paste: () => Promise<void>;
  /** Synthesize keystrokes for `text` into the foreground window. */
  typeText: (text: string) => Promise<void>;
  /** Lowercased executable name of the foreground window, or undefined if unknown. */
  getForegroundApp: () => Promise<string | undefined>;
  table?: InjectionTable;
}

export interface InjectionOutcome {
  strategy: InjectionStrategy;
  app?: string;
}

export interface Injector {
  inject: (text: string) => Promise<InjectionOutcome>;
}

export function createInjector(deps: InjectorDeps): Injector {
  return {
    inject: async (text) => {
      const app = await deps.getForegroundApp();
      const strategy = selectInjectionStrategy(app, deps.table);
      if (strategy === "type") {
        await deps.typeText(text);
      } else {
        deps.writeClipboard(text);
        if (strategy === "paste") await deps.paste();
      }
      return { strategy, app };
    },
  };
}
