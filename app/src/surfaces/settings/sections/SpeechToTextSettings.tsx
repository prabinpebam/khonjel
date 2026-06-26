import { useState } from "react";
import { useSettingsStore } from "@stores/settings";
import { Card } from "@components/ui/card";
import { Tabs } from "@components/ui/tabs";
import { InferenceConfigBlock, InferenceModeSelector } from "../inference";
import { LocalModelSetup } from "../LocalModelSetup";
import { AccelerationCard } from "../AccelerationCard";

type SttTab = "dictation" | "note";

export function SpeechToTextSettings() {
  const [tab, setTab] = useState<SttTab>("dictation");
  const prefix = `stt.${tab}`;
  const mode = useSettingsStore((s) => s.values[`${prefix}.mode`] ?? "local");

  return (
    <div>
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: "dictation", label: "Dictation" },
          { value: "note", label: "Note Recording" },
        ]}
      />

      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Inference mode</h3>
          <InferenceModeSelector
            modeKey={`${prefix}.mode`}
            modes={["local", "providers", "self-hosted", "enterprise", "cloud"]}
          />
        </section>

        <Card as="section" className="p-5">
          {mode === "local" ? (
            <div className="mb-4 flex flex-col gap-4">
              <LocalModelSetup compact={tab !== "dictation"} />
              {tab === "dictation" ? <AccelerationCard /> : null}
            </div>
          ) : null}
          <InferenceConfigBlock prefix={prefix} kind="stt" />
        </Card>
      </div>
    </div>
  );
}
