/**
 * Markdown renderer for assistant chat replies. Maps the BE-tested parse tree (lib/chat/markdown.ts)
 * to React elements only -- never raw HTML -- so XSS is impossible by construction and the strict
 * CSP holds. Fenced code blocks get a copy control. User messages are rendered as plain text by the
 * caller; only assistant replies pass through here. See the 06 chat spec SS5.4.
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { parseMarkdown, type MdBlock, type MdInline } from "@lib/chat/markdown";

function InlineNodes({ nodes }: { nodes: MdInline[] }) {
  return (
    <>
      {nodes.map((node, idx) => {
        switch (node.type) {
          case "text":
            return <span key={idx}>{node.value}</span>;
          case "code":
            return (
              <code key={idx} className="rounded bg-foreground/10 px-1 py-0.5 font-mono">
                {node.value}
              </code>
            );
          case "strong":
            return (
              <strong key={idx} className="font-semibold">
                <InlineNodes nodes={node.children} />
              </strong>
            );
          case "em":
            return (
              <em key={idx}>
                <InlineNodes nodes={node.children} />
              </em>
            );
          case "link":
            return (
              <a
                key={idx}
                href={node.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline underline-offset-2"
              >
                <InlineNodes nodes={node.children} />
              </a>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function CodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    window.electronAPI?.copyText?.(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative my-1 rounded-md border border-border bg-surface">
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy code"}
        onClick={copy}
        className="absolute right-1.5 top-1.5 rounded p-1 text-tertiary-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function MarkdownBlock({ block }: { block: MdBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <p className={block.level <= 2 ? "text-base font-semibold" : "text-sm font-semibold"}>
          <InlineNodes nodes={block.children} />
        </p>
      );
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap">
          <InlineNodes nodes={block.children} />
        </p>
      );
    case "code":
      return <CodeBlock value={block.value} />;
    case "list":
      return block.ordered ? (
        <ol className="ml-5 list-decimal space-y-0.5">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="ml-5 list-disc space-y-0.5">
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block} />
      ))}
    </div>
  );
}
