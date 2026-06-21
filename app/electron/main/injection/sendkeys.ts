/**
 * PURE Windows SendKeys escaping for the "type" injection strategy. SendKeys treats
 * {}()+^%~[] as syntax and needs literal characters wrapped in braces; newlines become {ENTER}.
 * Kept separate from win32.ts (which imports electron) so it is BE1-tested.
 */

/** Escape arbitrary text into a SendKeys-safe string. */
export function escapeSendKeys(text: string): string {
  return text
    .replace(/[{}]/g, "{$&}") // braces first: { -> {{} , } -> {}}
    .replace(/[+^%~()[\]]/g, "{$&}") // other syntax chars wrapped literally
    .replace(/\r\n|\r|\n/g, "{ENTER}");
}
