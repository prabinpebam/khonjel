/**
 * Real Windows injection bindings (the native edge; verified manually). No native node module:
 *   - clipboard via Electron's built-in `clipboard`
 *   - foreground app + keystrokes via short PowerShell calls (user32 + System.Windows.Forms.SendKeys)
 * The decision logic that uses these is BE1-tested in injector.ts / table.ts / sendkeys.ts.
 * On non-Windows these resolve to no-ops / undefined so the rest of the app still runs.
 */
import { clipboard } from "electron";
import { execFile, execFileSync } from "node:child_process";
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

// Core Audio (IAudioEndpointVolume) interop to SET the master mute state (not toggle), so we can
// mute other audio for a clean recording and reliably restore it. The interface placeholders
// (m1..m11) preserve the COM vtable layout up to SetMute (the 12th method).
const MUTE_CS = `using System;using System.Runtime.InteropServices;public class KhonjelAudio{[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class DevEnum{}[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMMDeviceEnumerator{int NotImpl1();int GetDefaultAudioEndpoint(int dataFlow,int role,out IMMDevice ppDevice);}[Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMMDevice{int Activate(ref Guid iid,int dwClsCtx,IntPtr pActivationParams,[MarshalAs(UnmanagedType.IUnknown)]out object ppInterface);}[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IAudioEndpointVolume{int m1();int m2();int m3();int m4();int m5();int m6();int m7();int m8();int m9();int m10();int m11();int SetMute([MarshalAs(UnmanagedType.Bool)]bool bMute,ref Guid ctx);}public static void SetMute(bool mute){var de=(IMMDeviceEnumerator)(new DevEnum());IMMDevice dev;de.GetDefaultAudioEndpoint(0,1,out dev);Guid iid=typeof(IAudioEndpointVolume).GUID;object o;dev.Activate(ref iid,23,IntPtr.Zero,out o);Guid ctx=Guid.Empty;((IAudioEndpointVolume)o).SetMute(mute,ref ctx);}}`;

// Serialize mute/unmute so a quick start->stop can never land out of order (stuck muted).
let audioOp: Promise<unknown> = Promise.resolve();

/** Set the default playback device's master mute on/off (Windows). Fire-and-forget + ordered. */
export function setSystemMute(muted: boolean): void {
  if (!isWindows) return;
  const script = `Add-Type -TypeDefinition '${MUTE_CS}'; [KhonjelAudio]::SetMute($${muted ? "true" : "false"})`;
  audioOp = audioOp.then(() => powershell(script).catch(() => undefined));
}

/** Synchronous unmute for shutdown safety, so quitting mid-recording can't leave audio muted. */
export function setSystemMuteSync(muted: boolean): void {
  if (!isWindows) return;
  try {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Add-Type -TypeDefinition '${MUTE_CS}'; [KhonjelAudio]::SetMute($${muted ? "true" : "false"})`,
      ],
      { windowsHide: true, timeout: 5000 },
    );
  } catch {
    // best effort on shutdown
  }
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
