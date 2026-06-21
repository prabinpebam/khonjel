import { useEffect, useState } from "react";
import { useSettingsStore } from "@stores/settings";
import { SettingGroup } from "@components/common/SettingRow";
import { Button } from "@components/ui/button";
import { Keycap } from "@components/ui/keycap";
import { Select } from "@components/ui/select";
import type { ReactNode } from "react";

const MODIFIERS = ["Control", "Meta", "Alt", "Shift"];

function comboFromEvent(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Win");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (MODIFIERS.includes(e.key)) return null;
  parts.push(e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

function HotkeyInput({ settingKey }: { settingKey: string }) {
  const value = useSettingsStore((s) => s.values[settingKey] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const combo = comboFromEvent(e);
      if (combo) {
        setValue(settingKey, combo);
        setListening(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, settingKey, setValue]);

  return (
    <button
      type="button"
      onClick={() => setListening(true)}
      className="inline-flex min-w-32 items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
    >
      {listening ? (
        <span className="text-muted-foreground">Press keys…</span>
      ) : value ? (
        <Keycap>{value}</Keycap>
      ) : (
        <span className="text-tertiary-foreground">Not set</span>
      )}
    </button>
  );
}

function InlineSelect({
  settingKey,
  options,
}: {
  settingKey: string;
  options: { value: string; label: string }[];
}) {
  const value = useSettingsStore((s) => s.values[settingKey] ?? options[0]?.value ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  return <Select value={value} onValueChange={(v) => setValue(settingKey, v)} options={options} />;
}

function HotkeyRow({
  title,
  subtitle,
  settingKey,
  resetTo,
  extra,
}: {
  title: string;
  subtitle: string;
  settingKey: string;
  resetTo?: string;
  extra?: ReactNode;
}) {
  const setValue = useSettingsStore((s) => s.setValue);
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        <HotkeyInput settingKey={settingKey} />
        {resetTo !== undefined ? (
          <Button variant="ghost" size="sm" onClick={() => setValue(settingKey, resetTo)}>
            Reset
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setValue(settingKey, "")}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export function HotkeysSettings() {
  return (
    <div>
      <SettingGroup label="Global hotkeys">
        <HotkeyRow
          title="Dictation"
          subtitle="Capture voice to text."
          settingKey="hotkey.dictation"
          resetTo="Ctrl+Win"
          extra={
            <InlineSelect
              settingKey="hotkey.dictation.mode"
              options={[
                { value: "tap", label: "Tap to toggle" },
                { value: "push", label: "Push to talk" },
              ]}
            />
          }
        />
      </SettingGroup>
    </div>
  );
}
