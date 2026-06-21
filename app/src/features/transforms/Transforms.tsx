import { useEffect, useRef, useState } from "react";
import { Info, Pencil, Plus, Trash2, X } from "lucide-react";
import { useServices } from "@services";
import type { Transform } from "@services/ports";
import { useSettingsStore } from "@stores/settings";
import { PageHeader } from "@components/common/PageHeader";
import { PromoBanner } from "@components/common/PromoBanner";
import { Button } from "@components/ui/button";
import { Card } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Keycap } from "@components/ui/keycap";
import { Switch } from "@components/ui/switch";
import { Textarea } from "@components/ui/textarea";

export function Transforms() {
  const { content } = useServices();
  const [transforms, setTransforms] = useState<Transform[]>([]);
  const optIn = useSettingsStore((s) => s.toggles["transforms.optIn"] ?? false);
  const setToggle = useSettingsStore((s) => s.setToggle);
  const loadedRef = useRef(false);
  const [draft, setDraft] = useState<Transform | null>(null);
  const [promoVisible, setPromoVisible] = useState(true);

  useEffect(() => {
    let live = true;
    void content.transforms().then((t) => {
      if (!live) return;
      setTransforms(t);
      loadedRef.current = true;
    });
    return () => {
      live = false;
    };
  }, [content]);

  // Persist enable/disable + edits to the durable store.
  useEffect(() => {
    if (loadedRef.current) void content.saveTransforms(transforms);
  }, [transforms, content]);

  function toggleEnabled(id: string) {
    setTransforms((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  }

  function createNew() {
    setDraft({
      id: globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}`,
      name: "",
      description: "",
      hotkey: "",
      builtin: false,
      enabled: true,
      prompt: "",
    });
  }

  function deleteTransform(id: string) {
    setTransforms((prev) => prev.filter((t) => t.id !== id));
  }

  function saveDraft() {
    if (!draft || draft.name.trim() === "") return;
    setTransforms((prev) => {
      const idx = prev.findIndex((t) => t.id === draft.id);
      if (idx === -1) return [...prev, draft];
      const copy = prev.slice();
      copy[idx] = draft;
      return copy;
    });
    setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="Transforms"
        description="Hotkey-bound AI rewrites that work anywhere you type."
        actions={
          <div className="flex items-center gap-3">
            <button type="button" aria-label="About transforms" title="Bind an AI rewrite to a hotkey.">
              <Info className="size-4 text-tertiary-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Opt in</span>
              <Switch
                label="Opt in to transforms"
                checked={optIn}
                onCheckedChange={(v) => setToggle("transforms.optIn", v)}
              />
            </div>
          </div>
        }
      />

      <p className="mb-4 text-xs text-tertiary-foreground">
        Select text in any app, then press a transform's hotkey to rewrite it in place.
      </p>

      {promoVisible ? (
        <div className="mb-6">
          <PromoBanner
            headline="Transforms work anywhere you write."
            supporting="Select text, press a hotkey, and Khonjel rewrites it in place."
            chips={["Polish", "Prompt Engineer", "Custom"]}
            onDismiss={() => setPromoVisible(false)}
          />
        </div>
      ) : null}

      {draft ? (
        <TransformEditor draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={() => setDraft(null)} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {transforms.map((transform) => (
          <Card key={transform.id} className="group flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between">
              <Keycap>{transform.hotkey}</Keycap>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ ...transform })}>
                  <Pencil />
                </Button>
                {!transform.builtin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => deleteTransform(transform.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{transform.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{transform.description}</p>
            </div>
            <div className="mt-auto flex items-center justify-between pt-2">
              {transform.builtin ? (
                <span className="text-xs text-tertiary-foreground">Built-in</span>
              ) : (
                <span className="text-xs text-tertiary-foreground">Custom</span>
              )}
              <Switch
                label={`Enable ${transform.name}`}
                checked={transform.enabled}
                onCheckedChange={() => toggleEnabled(transform.id)}
              />
            </div>
          </Card>
        ))}

        <button
          type="button"
          onClick={createNew}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">Create your own</span>
        </button>
      </div>
    </div>
  );
}

function TransformEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Transform;
  onChange: (t: Transform) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="mb-6 space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {draft.name.trim() === "" ? "New transform" : "Edit transform"}
        </span>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onCancel}>
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Name"
          disabled={draft.builtin}
        />
        <Input
          value={draft.hotkey}
          onChange={(e) => onChange({ ...draft, hotkey: e.target.value })}
          placeholder="Hotkey (e.g. Win+Alt+1)"
        />
      </div>
      <Input
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        placeholder="Description"
        disabled={draft.builtin}
      />
      <Textarea
        value={draft.prompt}
        onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
        placeholder="Instruction sent to the AI along with the selected text"
        rows={4}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={draft.name.trim() === ""}>
          Save
        </Button>
      </div>
    </Card>
  );
}
