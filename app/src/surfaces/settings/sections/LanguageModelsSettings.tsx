import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@stores/settings";
import { SettingGroup } from "@components/common/SettingRow";
import { Label } from "@components/ui/label";
import { Tabs } from "@components/ui/tabs";
import { Textarea } from "@components/ui/textarea";
import { ToggleRow } from "../controls";
import { InferenceConfigBlock, InferenceModeSelector } from "../inference";
import { LocalModelSetup } from "../LocalModelSetup";

type Purpose = "cleanup" | "agent" | "note" | "chat";

// One language model powers every task. We edit the chat slot (what the chat badge + the
// sidebar engine card show) and mirror its model selection to the other LLM tasks, so changing
// the model in one place is reflected everywhere instead of silently editing a single tab.
const MIRROR_SLOTS = ["llm.cleanup", "llm.agent", "llm.note"];

export function LanguageModelsSettings() {
  const [tab, setTab] = useState<Purpose>("chat");
  const setValue = useSettingsStore((s) => s.setValue);

  const chatMode = useSettingsStore((s) => s.values["llm.chat.mode"] ?? "local");
  const chatModel = useSettingsStore((s) => s.values["llm.chat.model"] ?? "");
  const chatConnectionId = useSettingsStore((s) => s.values["llm.chat.connectionId"] ?? "");
  const chatTarget = useSettingsStore((s) => s.values["llm.chat.target"] ?? "");
  const mounted = useRef(false);
  useEffect(() => {
    // Preserve any existing per-task values on open; only mirror genuine edits made afterwards.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    for (const slot of MIRROR_SLOTS) {
      setValue(`${slot}.mode`, chatMode);
      setValue(`${slot}.model`, chatModel);
      setValue(`${slot}.connectionId`, chatConnectionId);
      setValue(`${slot}.target`, chatTarget);
    }
  }, [chatMode, chatModel, chatConnectionId, chatTarget, setValue]);

  const systemPrompt = useSettingsStore((s) => s.values[`llm.${tab}.systemPrompt`] ?? "");

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Language model</h3>
        <p className="mb-3 text-xs text-tertiary-foreground">
          One model powers dictation cleanup, the voice agent, note formatting, and chat.
        </p>
        <InferenceModeSelector
          modeKey="llm.chat.mode"
          modes={["local", "providers", "self-hosted", "enterprise", "cloud"]}
        />
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        {chatMode === "local" ? (
          <div className="mb-4">
            <LocalModelSetup />
          </div>
        ) : null}
        <InferenceConfigBlock prefix="llm.chat" kind="llm" />
      </section>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Per-task options</h3>
        <Tabs
          className="mb-4"
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
            <>
              <SettingGroup>
                <ToggleRow title="Enable text cleanup" settingKey="llm.cleanup.enabled" />
                <ToggleRow
                  title="Disable thinking output"
                  subtitle="Suppress reasoning tokens for faster cleanup."
                  settingKey="llm.cleanup.disableThinking"
                />
              </SettingGroup>
              <section className="flex flex-col gap-1.5">
                <Label>Cleanup system prompt</Label>
                <Textarea
                  rows={4}
                  value={systemPrompt}
                  placeholder="Fix grammar, punctuation, and filler words without changing meaning."
                  onChange={(e) => setValue("llm.cleanup.systemPrompt", e.target.value)}
                />
                <p className="text-xs text-tertiary-foreground">
                  Customize how dictation is polished. Leave blank to use the built-in prompt.
                </p>
              </section>
            </>
          ) : null}
          {tab === "agent" ? (
            <SettingGroup>
              <ToggleRow
                title="Reasoning mode"
                subtitle="Show the agent's reasoning in its response."
                settingKey="llm.agent.reasoning"
              />
            </SettingGroup>
          ) : null}
          {tab === "note" ? (
            <SettingGroup>
              <ToggleRow title="Auto-generate note title" settingKey="llm.note.autoTitle" />
            </SettingGroup>
          ) : null}
          {tab === "chat" ? (
            <>
              <SettingGroup>
                <ToggleRow title="Reasoning mode" settingKey="llm.chat.reasoning" />
              </SettingGroup>
              <section className="flex flex-col gap-1.5">
                <Label>System prompt</Label>
                <Textarea
                  rows={4}
                  value={systemPrompt}
                  placeholder="You are Khonjel, a helpful on-device assistant…"
                  onChange={(e) => setValue("llm.chat.systemPrompt", e.target.value)}
                />
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
