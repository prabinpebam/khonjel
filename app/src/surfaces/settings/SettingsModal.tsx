import type { ComponentType } from "react";
import { X } from "lucide-react";
import { SETTINGS_GROUPS, type SettingsSectionId } from "@config/settings";
import { useUiStore } from "@stores/ui";
import { Button } from "@components/ui/button";
import { Modal } from "@components/ui/modal";
import { cn } from "@lib/utils";
import { GeneralSettings } from "./sections/GeneralSettings";
import { HotkeysSettings } from "./sections/HotkeysSettings";
import { SpeechToTextSettings } from "./sections/SpeechToTextSettings";
import { LanguageModelsSettings } from "./sections/LanguageModelsSettings";
import { ConnectionsSettings } from "./sections/ConnectionsSettings";
import { PrivacySettings } from "./sections/PrivacySettings";
import { SystemSettings } from "./sections/SystemSettings";

const SECTIONS: Record<SettingsSectionId, ComponentType> = {
  general: GeneralSettings,
  hotkeys: HotkeysSettings,
  "speech-to-text": SpeechToTextSettings,
  "language-models": LanguageModelsSettings,
  connections: ConnectionsSettings,
  privacy: PrivacySettings,
  system: SystemSettings,
};

export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const section = useUiStore((s) => s.settingsSection);
  const setSection = useUiStore((s) => s.setSettingsSection);
  const close = useUiStore((s) => s.closeSettings);

  const Section = SECTIONS[section];
  const title =
    SETTINGS_GROUPS.flatMap((g) => g.items).find((i) => i.id === section)?.label ?? "Settings";

  return (
    <Modal open={open} onClose={close} labelledBy="settings-title" className="max-w-4xl">
      <div className="flex h-[80vh]" data-eval="settings-modal">
        <nav className="flex w-48 shrink-0 flex-col overflow-y-auto border-e border-border bg-surface-2 p-3">
          {SETTINGS_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === section;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-surface text-foreground shadow-nav"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="mt-auto px-2 pt-2 text-xs text-tertiary-foreground">v0.1.0-mock</p>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 id="settings-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <Button variant="ghost" size="icon" aria-label="Close settings" onClick={close}>
              <X />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <Section />
          </div>
        </div>
      </div>
    </Modal>
  );
}
