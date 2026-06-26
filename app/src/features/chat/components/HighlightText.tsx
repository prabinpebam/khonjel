import { splitHighlight } from "@lib/chat/search";

/** Render text with case-insensitive matches of `query` highlighted. */
export function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-primary/25 text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
