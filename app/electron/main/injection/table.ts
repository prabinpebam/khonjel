/**
 * Per-app text-injection table + strategy selection (PURE, BE1-tested).
 *
 * After dictation the cleaned text must land in whatever app had focus. Different apps accept
 * injected text differently, so we pick a strategy per foreground process:
 *   - "paste"     : set the clipboard, then send Ctrl+V (fast, preserves formatting; the default).
 *   - "type"      : synthesize keystrokes char-by-char (for terminals/editors that mishandle paste
 *                   or bracketed-paste).
 *   - "clipboard" : only set the clipboard and let the user paste (apps where synthetic input is
 *                   blocked, e.g. elevated/remote windows).
 * The real keystroke/clipboard/foreground bindings live in ./win32.ts; this file is just the
 * decision logic so it is unit-tested without the OS.
 */

export type InjectionStrategy = "paste" | "type" | "clipboard";

export interface InjectionRule {
  /** Lowercased executable name to match, e.g. "windowsterminal.exe". */
  app: string;
  strategy: InjectionStrategy;
}

export interface InjectionTable {
  default: InjectionStrategy;
  rules: InjectionRule[];
}

export const DEFAULT_INJECTION_TABLE: InjectionTable = {
  default: "paste",
  rules: [
    // Terminals/consoles where bracketed paste is unreliable -> type the characters.
    { app: "windowsterminal.exe", strategy: "type" },
    { app: "cmd.exe", strategy: "type" },
    { app: "powershell.exe", strategy: "type" },
    { app: "conhost.exe", strategy: "type" },
    // Remote-desktop / virtualization windows reject synthetic paste -> clipboard only.
    { app: "mstsc.exe", strategy: "clipboard" },
    { app: "vmconnect.exe", strategy: "clipboard" },
  ],
};

/** PURE: choose the injection strategy for the focused app (falls back to the table default). */
export function selectInjectionStrategy(
  appName: string | undefined,
  table: InjectionTable = DEFAULT_INJECTION_TABLE,
): InjectionStrategy {
  if (!appName) return table.default;
  const key = appName.toLowerCase();
  return table.rules.find((rule) => rule.app === key)?.strategy ?? table.default;
}

/**
 * Apps where synthetic text could be executed as a command (shells/consoles). When injecting into
 * these, a trailing newline must be suppressed so dictated text cannot auto-run (security WS-H/H1).
 */
export const SHELL_APPS = new Set<string>([
  "windowsterminal.exe",
  "wt.exe",
  "cmd.exe",
  "powershell.exe",
  "pwsh.exe",
  "conhost.exe",
]);

/** PURE: is the focused app a shell/console where auto-ENTER would be dangerous? */
export function isShellApp(appName: string | undefined): boolean {
  return appName ? SHELL_APPS.has(appName.toLowerCase()) : false;
}
