/**
 * Real OS keyboard injection for EDD (Windows).
 *
 * Electron's `globalShortcut` listens to **system-wide** keyboard events, so the only honest way to
 * prove "pressing the dictation hotkey triggers dictation" is to inject a real OS key chord — not to
 * call a dev bridge. We synthesize key-down/key-up events via Win32 `SendInput` (the API the OS
 * treats as genuine hardware input, which reliably fires registered global hotkeys), driven by a
 * short PowerShell call. Because the shortcut is global, the target app does not need focus.
 *
 * Accelerators are Electron-normalized strings (e.g. "Control+Shift+Space", "Control+Super").
 */
import { execFileSync } from "node:child_process";

/** Electron accelerator token -> Win32 virtual-key code. */
function vkFor(token) {
  const named = {
    Control: 0x11,
    Super: 0x5b, // Left Windows key (VK_LWIN)
    Shift: 0x10,
    Alt: 0x12,
    Space: 0x20,
    Tab: 0x09,
    Enter: 0x0d,
    Escape: 0x1b,
  };
  if (named[token] != null) return named[token];
  if (/^[A-Z0-9]$/.test(token)) return token.charCodeAt(0); // 'A'..'Z' / '0'..'9' map to their VK
  throw new Error(`pressChord: no virtual-key mapping for accelerator token "${token}"`);
}

const CSHARP = `
using System;
using System.Runtime.InteropServices;
public static class KhonjelSim {
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)]
  public struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public MOUSEINPUT mi; }
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT { public uint type; public INPUTUNION u; }
  [DllImport("user32.dll", SetLastError=true)]
  static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  public static void Key(ushort vk, bool up) {
    INPUT[] inp = new INPUT[1];
    inp[0].type = 1; // INPUT_KEYBOARD
    inp[0].u.ki.wVk = vk;
    inp[0].u.ki.dwFlags = up ? 0x0002u : 0u; // KEYEVENTF_KEYUP
    SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
  }
}
`;

function runPowerShell(body) {
  const script = ["$cs = @'", CSHARP, "'@", "Add-Type -TypeDefinition $cs", ...body].join("\n");
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: "ignore",
  });
}

/**
 * Synthesize a real OS press of `accelerator`: press every key down in order, then release in
 * reverse. Throws if any token has no VK mapping (so an untestable hotkey fails loudly).
 */
export function pressChord(accelerator) {
  const codes = accelerator.split("+").map((t) => vkFor(t.trim()));
  const down = codes.map((c) => `[KhonjelSim]::Key(${c}, $false)`);
  const up = [...codes].reverse().map((c) => `[KhonjelSim]::Key(${c}, $true)`);
  runPowerShell([...down, "Start-Sleep -Milliseconds 40", ...up]);
}

/** Tap Escape (used to dismiss a Start menu a lone Win keyup may have surfaced). */
export function pressEscape() {
  pressChord("Escape");
}
