import { useEffect, useRef } from "react";
import { useDictation, type UseDictation } from "@hooks/useDictation";

/** Join a field's existing text with dictated text (single space, no leading/trailing gaps). */
function joinText(base: string, text: string): string {
  if (!base) return text;
  if (!text) return base;
  return `${base} ${text}`;
}

/**
 * useDictationField — dictation bound to a text field with a **live, growing transcript** (12 §2A).
 *
 * While recording, the field shows the raw transcript streaming in window-by-window (fast feedback);
 * when capture ends, the field is replaced with the high-quality cleaned text (the live-vs-quality
 * balance). Snapshots the field at capture start so dictation *appends* to whatever was already there
 * instead of clobbering it. Used by Chat, Notes, and any other dictation entry point.
 */
export function useDictationField(
  value: string,
  onChange: (next: string) => void,
  opts: { onLevel?: (level: number) => void } = {},
): UseDictation {
  // Refs avoid re-subscribing/looping: effects read the latest value/onChange without depending on them.
  const baseRef = useRef(value);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const dictation = useDictation((finalText) => {
    // Capture finished: swap the live raw preview for the cleaned, corrected final text.
    onChangeRef.current(joinText(baseRef.current, finalText));
  }, opts);

  const prevStatusRef = useRef(dictation.status);

  // Snapshot the field the moment recording starts, so we append rather than overwrite.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = dictation.status;
    if (dictation.status === "recording" && prev !== "recording") {
      baseRef.current = valueRef.current;
    }
  }, [dictation.status]);

  // Reflect each completed window into the field as it streams in.
  useEffect(() => {
    if (dictation.status === "recording") {
      onChangeRef.current(joinText(baseRef.current, dictation.partialText));
    }
  }, [dictation.partialText, dictation.status]);

  return dictation;
}
