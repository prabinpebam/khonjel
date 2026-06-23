import { useState } from "react";
import { SettingGroup } from "@components/common/SettingRow";
import { Tabs } from "@components/ui/tabs";
import { ToggleRow } from "../controls";
import { InferenceConfigBlock, InferenceModeSelector } from "../inference";
import { LocalModelSetup } from "../LocalModelSetup";

type SttTab = "dictation" | "note";

export function SpeechToTextSettings() {
  const [tab, setTab] = useState<SttTab>("dictation");
  const prefix = `stt.${tab}`;

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

        <section className="rounded-md border border-border bg-surface p-5">
          <LocalModelSetup compact={tab !== "dictation"} />
          <div className="mt-4">
          <InferenceConfigBlock prefix={prefix} kind="stt" />
          </div>
        </section>

        {tab === "dictation" ? (
          <SettingGroup label="Options">
            <ToggleRow
              title="Transcription preview"
              subtitle="Show the floating bar while you speak."
              settingKey="stt.dictation.preview"
            />
          </SettingGroup>
        ) : null}
      </div>
    </div>
  );
}
