import { useState } from "react";
import { useServices } from "@services";
import type { ModelInfo } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { SettingGroup } from "@components/common/SettingRow";
import { Tabs } from "@components/ui/tabs";
import { ToggleRow } from "../controls";
import { InferenceConfigBlock, InferenceModeSelector } from "../inference";

type SttTab = "dictation" | "note";

export function SpeechToTextSettings() {
  const { content } = useServices();
  const models = useAsync(() => content.sttModels(), [] as ModelInfo[]);
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
          <InferenceConfigBlock prefix={prefix} kind="stt" models={models} />
        </section>

        <SettingGroup label="Options">
          {tab === "dictation" ? (
            <ToggleRow
              title="Transcription preview"
              subtitle="Show a live HUD while you speak."
              settingKey="stt.dictation.preview"
            />
          ) : (
            <>
              <ToggleRow
                title="Diarization"
                subtitle="Identify and label speakers."
                settingKey="stt.note.diarization"
              />
              <ToggleRow title="Speaker labels" settingKey="stt.note.speakerLabels" />
            </>
          )}
        </SettingGroup>
      </div>
    </div>
  );
}
