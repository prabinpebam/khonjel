/**
 * Text injector: routes cleaned dictation text into the focused app using the per-app strategy
 * from ./table.ts. The OS bindings (clipboard write, paste keystroke, char typing, foreground-app
 * lookup) are INJECTED, so the routing logic is BE1-tested without touching the OS; the composition
 * root supplies the real win32 bindings (./win32.ts).
 */
import { selectInjectionStrategy, isShellApp, type InjectionStrategy, type InjectionTable } from "./table";

export interface InjectorDeps {
  writeClipboard: (text: string) => void;
  /** Read the current clipboard text, so a paste injection can restore it afterwards. */
  readClipboard?: () => string;
  /** Send Ctrl+V to the foreground window. */
  paste: () => Promise<void>;
  /** Synthesize keystrokes for `text` into the foreground window. */
  typeText: (text: string) => Promise<void>;
  /** Lowercased executable name of the foreground window, or undefined if unknown. */
  getForegroundApp: () => Promise<string | undefined>;
  table?: InjectionTable;
  /** Delay before restoring the clipboard after a paste (injected so tests run instantly). */
  sleep?: (ms: number) => Promise<void>;
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
        // Into a shell/console a trailing newline would auto-execute the typed text; strip it.
        const safe = isShellApp(app) ? text.replace(/[\r\n]+$/, "") : text;
        await deps.typeText(safe);
      } else {
        // Preserve the user's clipboard: snapshot it, paste our text, then restore it.
        const restore = strategy === "paste" && deps.readClipboard ? deps.readClipboard() : null;
        deps.writeClipboard(text);
        if (strategy === "paste") {
          await deps.paste();
          if (restore != null) {
            const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
            await sleep(150); // let the target app consume the paste before we restore
            deps.writeClipboard(restore);
          }
        }
      }
      return { strategy, app };
    },
  };
}
