/**
 * Pure markdown subset parser for chat replies. Produces a typed tree the renderer maps to React
 * elements (never raw HTML), keeping the strict CSP + hardened-renderer guarantees intact. Supports
 * headings, paragraphs, bold/italic/inline-code, safe links, fenced code, and lists. See the 06 chat
 * spec SS5.4; the renderer lives in features/chat/Markdown.tsx.
 */

export type MdInline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: MdInline[] }
  | { type: "em"; children: MdInline[] }
  | { type: "link"; href: string; children: MdInline[] };

export type MdBlock =
  | { type: "heading"; level: number; children: MdInline[] }
  | { type: "paragraph"; children: MdInline[] }
  | { type: "code"; lang: string; value: string }
  | { type: "list"; ordered: boolean; items: MdInline[][] };

/** Only http(s) + mailto links survive; anything else (javascript:, data:, ...) renders as text. */
function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url.trim());
}

/** PURE: parse a single line's text into inline nodes (recursive for nested emphasis). */
export function parseInline(text: string): MdInline[] {
  const out: MdInline[] = [];
  let buf = "";
  let i = 0;
  const flush = (): void => {
    if (buf) out.push({ type: "text", value: buf });
    buf = "";
  };
  while (i < text.length) {
    const rest = text.slice(i);
    // Inline code (literal, no nested parsing) -- highest precedence.
    if (rest.charAt(0) === "`") {
      const end = rest.indexOf("`", 1);
      if (end > 0) {
        flush();
        out.push({ type: "code", value: rest.slice(1, end) });
        i += end + 1;
        continue;
      }
    }
    // Bold (** or __) before italic so the double marker wins.
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const marker = rest.slice(0, 2);
      const end = text.indexOf(marker, i + 2);
      if (end > i + 1) {
        flush();
        out.push({ type: "strong", children: parseInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // Italic (* or _).
    if (rest.charAt(0) === "*" || rest.charAt(0) === "_") {
      const marker = rest.charAt(0);
      const end = text.indexOf(marker, i + 1);
      if (end > i) {
        flush();
        out.push({ type: "em", children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    // Link [label](url) with a safe URL.
    if (rest.charAt(0) === "[") {
      const close = rest.indexOf("]");
      if (close > 0 && rest.charAt(close + 1) === "(") {
        const paren = rest.indexOf(")", close + 2);
        if (paren > close + 1) {
          const url = rest.slice(close + 2, paren);
          if (isSafeUrl(url)) {
            flush();
            out.push({ type: "link", href: url.trim(), children: parseInline(rest.slice(1, close)) });
            i += paren + 1;
            continue;
          }
        }
      }
    }
    buf += text.charAt(i);
    i += 1;
  }
  flush();
  return out;
}

const FENCE = /^```(\w*)\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const UL_ITEM = /^\s*[-*+]\s+(.+)$/;
const OL_ITEM = /^\s*\d+\.\s+(.+)$/;

function isBlockStart(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || UL_ITEM.test(line) || OL_ITEM.test(line);
}

/** PURE: parse markdown source into a flat list of blocks. */
export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // consume the closing fence (no-op past EOF)
      blocks.push({ type: "code", lang: fence[1] ?? "", value: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: (heading[1] ?? "").length, children: parseInline(heading[2] ?? "") });
      i += 1;
      continue;
    }

    if (UL_ITEM.test(line) || OL_ITEM.test(line)) {
      const ordered = OL_ITEM.test(line);
      const items: MdInline[][] = [];
      while (i < lines.length) {
        const match = ordered ? OL_ITEM.exec(lines[i] ?? "") : UL_ITEM.exec(lines[i] ?? "");
        if (!match) break;
        items.push(parseInline(match[1] ?? ""));
        i += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      if (l.trim() === "" || isBlockStart(l)) break;
      para.push(l);
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
  }
  return blocks;
}
