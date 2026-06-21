import { useEffect, useState } from "react";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { Transform } from "@services/ports";
import { useSettingsStore } from "@stores/settings";
import { PageHeader } from "@components/common/PageHeader";
import { PromoBanner } from "@components/common/PromoBanner";
import { Button } from "@components/ui/button";
import { Card } from "@components/ui/card";
import { Keycap } from "@components/ui/keycap";
import { Switch } from "@components/ui/switch";

export function Transforms() {
  const { content } = useServices();
  const [transforms, setTransforms] = useState<Transform[]>([]);
  const optIn = useSettingsStore((s) => s.toggles["transforms.optIn"] ?? false);
  const setToggle = useSettingsStore((s) => s.setToggle);

  useEffect(() => {
    let live = true;
    void content.transforms().then((t) => {
      if (live) setTransforms(t);
    });
    return () => {
      live = false;
    };
  }, [content]);

  function toggleEnabled(id: string) {
    setTransforms((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
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
        View changes: <Keycap>Win+Alt+O</Keycap>
      </p>

      <div className="mb-6">
        <PromoBanner
          headline="Transforms work anywhere you write."
          supporting="Select text, press a hotkey, and Khonjel rewrites it in place."
          chips={["Polish", "Prompt Engineer", "Custom"]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {transforms.map((transform) => (
          <Card key={transform.id} className="group flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between">
              <Keycap>{transform.hotkey}</Keycap>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil />
                </Button>
                {!transform.builtin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-danger"
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
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">Create your own</span>
        </button>
      </div>
    </div>
  );
}
