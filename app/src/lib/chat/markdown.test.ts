/**
 * Pure markdown subset parser for chat (BE-tested). Produces a typed block/inline tree that the
 * renderer maps to React elements -- never raw HTML -- so the strict CSP + hardened-renderer
 * guarantees hold (no dangerouslySetInnerHTML, no script/style/iframe injection). Supports the
 * common assistant-reply subset: headings, paragraphs, bold/italic/inline-code, links (http(s)/
 * mailto only), fenced code blocks, and unordered/ordered lists. See 06 chat spec SS5.4.
 */
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";

describe("parseMarkdown — blocks", () => {
  it("parses a heading with a level", () => {
    expect(parseMarkdown("## Hello world")).toEqual([
      { type: "heading", level: 2, children: [{ type: "text", value: "Hello world" }] },
    ]);
  });

  it("joins consecutive lines into one paragraph", () => {
    expect(parseMarkdown("one\ntwo")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "one two" }] },
    ]);
  });

  it("separates paragraphs on a blank line", () => {
    const blocks = parseMarkdown("a\n\nb");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
  });

  it("parses a fenced code block with a language and keeps content literal", () => {
    expect(parseMarkdown("```ts\nconst x = **1**;\n```")).toEqual([
      { type: "code", lang: "ts", value: "const x = **1**;" },
    ]);
  });

  it("keeps an unterminated fence as a code block", () => {
    expect(parseMarkdown("```\nstill code")).toEqual([{ type: "code", lang: "", value: "still code" }]);
  });

  it("parses an unordered list", () => {
    expect(parseMarkdown("- a\n- b")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", value: "a" }], [{ type: "text", value: "b" }]],
      },
    ]);
  });

  it("parses an ordered list", () => {
    expect(parseMarkdown("1. first\n2. second")).toMatchObject([{ type: "list", ordered: true }]);
  });
});

describe("parseMarkdown — inline", () => {
  const inline = (src: string) => {
    const blocks = parseMarkdown(src);
    const first = blocks[0];
    return first && first.type === "paragraph" ? first.children : [];
  };

  it("parses bold", () => {
    expect(inline("a **b** c")).toEqual([
      { type: "text", value: "a " },
      { type: "strong", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " c" },
    ]);
  });

  it("parses italic with underscores", () => {
    expect(inline("_hi_")).toEqual([{ type: "em", children: [{ type: "text", value: "hi" }] }]);
  });

  it("parses inline code literally (no nested markdown)", () => {
    expect(inline("use `a **b**` here")).toEqual([
      { type: "text", value: "use " },
      { type: "code", value: "a **b**" },
      { type: "text", value: " here" },
    ]);
  });

  it("parses a safe link", () => {
    expect(inline("[site](https://example.com)")).toEqual([
      { type: "link", href: "https://example.com", children: [{ type: "text", value: "site" }] },
    ]);
  });

  it("renders an unsafe link as plain text (drops javascript: URLs)", () => {
    expect(inline("[x](javascript:alert(1))")).toEqual([{ type: "text", value: "[x](javascript:alert(1))" }]);
  });

  it("leaves an unmatched marker as literal text", () => {
    expect(inline("2 * 3 = 6")).toEqual([{ type: "text", value: "2 * 3 = 6" }]);
  });
});
