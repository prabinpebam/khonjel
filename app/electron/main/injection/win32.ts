/**
 * Real Windows injection bindings (the native edge; verified manually). No native node module:
 *   - clipboard via Electron's built-in `clipboard`
 *   - foreground app + keystrokes via short PowerShell calls (user32 + System.Windows.Forms.SendKeys)
 * The decision logic that uses these is BE1-tested in injector.ts / table.ts / sendkeys.ts.
 * On non-Windows these resolve to no-ops / undefined so the rest of the app still runs.
 */
import { clipboard } from "electron";
import { execFile } from "node:child_process";
import { escapeSendKeys } from "./sendkeys";

const isWindows = process.platform === "win32";

function powershell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout).trim());
      },
    );
  });
}

export function writeClipboard(text: string): void {
  clipboard.writeText(text);
}

const FOREGROUND_SCRIPT = [
  "$sig = '[DllImport(\"user32.dll\")] public static extern System.IntPtr GetForegroundWindow();",
  "[DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p);';",
  "$t = Add-Type -MemberDefinition $sig -Name Fg -Namespace Win -PassThru;",
  "$h = $t::GetForegroundWindow(); $p = 0; [void]$t::GetWindowThreadProcessId($h, [ref]$p);",
  "(Get-Process -Id $p).ProcessName",
].join(" ");

export async function getForegroundApp(): Promise<string | undefined> {
  if (!isWindows) return undefined;
  try {
    const name = await powershell(FOREGROUND_SCRIPT);
    return name ? `${name.toLowerCase()}.exe` : undefined;
  } catch {
    return undefined;
  }
}

export async function paste(): Promise<void> {
  if (!isWindows) return;
  await powershell(
    "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
  );
}

export async function typeText(text: string): Promise<void> {
  if (!isWindows) return;
  const keys = escapeSendKeys(text).replace(/'/g, "''"); // PowerShell single-quote escaping
  await powershell(
    `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${keys}')`,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copy the focused app's current selection and return it. Sends Ctrl+C, then polls the clipboard
 * until it changes (the target app handles the keystroke asynchronously). OS edge -- verified
 * manually, like the rest of win32.ts; non-Windows resolves to an empty string.
 */
export async function captureSelection(): Promise<string> {
  if (!isWindows) return "";
  const before = clipboard.readText();
  await powershell(
    "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')",
  );
  for (let i = 0; i < 10; i++) {
    await delay(30);
    const now = clipboard.readText();
    if (now && now !== before) return now;
  }
  return clipboard.readText();
}
