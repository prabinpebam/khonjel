import { useState } from "react";
import { useServices } from "@services";
import type { ModelInfo } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { useSettingsStore } from "@stores/settings";
import { SettingGroup } from "@components/common/SettingRow";
import { Label } from "@components/ui/label";
import { Tabs } from "@components/ui/tabs";
import { Textarea } from "@components/ui/textarea";
import { ToggleRow } from "../controls";
import { InferenceConfigBlock, InferenceModeSelector } from "../inference";

type Purpose = "cleanup" | "agent" | "note" | "chat";

export function LanguageModelsSettings() {
  const { content } = useServices();
  const models = useAsync(() => content.llmModels(), [] as ModelInfo[]);
  const [tab, setTab] = useState<Purpose>("cleanup");
  const prefix = `llm.${tab}`;

  const systemPrompt = useSettingsStore((s) => s.values[`${prefix}.systemPrompt`] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);

  return (
    <div>
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        items={[
          { value: "cleanup", label: "Dictation Cleanup" },
          { value: "agent", label: "Voice Agent" },
          { value: "note", label: "Note Formatting" },
          { value: "chat", label: "Chat" },
        ]}
      />

      <div className="flex flex-col gap-5">
        {tab === "cleanup" ? (
          <SettingGroup>
            <ToggleRow title="Enable text cleanup" settingKey="llm.cleanup.enabled" />
          </SettingGroup>
        ) : null}
        {tab === "note" ? (
          <SettingGroup>
            <ToggleRow title="Auto-generate note title" settingKey="llm.note.autoTitle" />
          </SettingGroup>
        ) : null}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Inference mode</h3>
          <InferenceModeSelector
            modeKey={`${prefix}.mode`}
            modes={["local", "providers", "self-hosted", "enterprise", "cloud"]}
          />
        </section>

        <section className="rounded-md border border-border bg-surface p-5">
          <InferenceConfigBlock prefix={prefix} kind="llm" models={models} />
        </section>

        <SettingGroup label="Options">
          {tab === "cleanup" ? (
            <ToggleRow
              title="Disable thinking output"
              subtitle="Suppress reasoning tokens for faster cleanup."
              settingKey="llm.cleanup.disableThinking"
            />
          ) : null}
          {tab === "agent" ? (
            <ToggleRow
              title="Reasoning mode"
              subtitle="Show the agent's reasoning in its response."
              settingKey="llm.agent.reasoning"
            />
          ) : null}
          {tab === "chat" ? (
            <ToggleRow title="Reasoning mode" settingKey="llm.chat.reasoning" />
          ) : null}
        </SettingGroup>

        {tab === "cleanup" ? (
          <section className="flex flex-col gap-1.5">
            <Label>Cleanup system prompt</Label>
            <Textarea
              rows={4}
              value={systemPrompt}
              placeholder="Fix grammar, punctuation, and filler words without changing meaning."
              onChange={(e) => setValue(`${prefix}.systemPrompt`, e.target.value)}
            />
            <p className="text-xs text-tertiary-foreground">
              Customize how dictation is polished. Leave blank to use the built-in prompt.
            </p>
          </section>
        ) : null}

        {tab === "chat" ? (
          <section className="flex flex-col gap-1.5">
            <Label>System prompt</Label>
            <Textarea
              rows={4}
              value={systemPrompt}
              placeholder="You are Khonjel, a helpful on-device assistant…"
              onChange={(e) => setValue(`${prefix}.systemPrompt`, e.target.value)}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
