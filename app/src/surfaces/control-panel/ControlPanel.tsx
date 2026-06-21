import { useEffect, type ComponentType } from "react";
import type { NavId } from "@config/nav";
import { useUiStore } from "@stores/ui";
import { Home } from "@features/home/Home";
import { Insights } from "@features/insights/Insights";
import { Chat } from "@features/chat/Chat";
import { Notes } from "@features/notes/Notes";
import { Upload } from "@features/upload/Upload";
import { Dictionary } from "@features/dictionary/Dictionary";
import { Transforms } from "@features/transforms/Transforms";
import { Integrations } from "@features/integrations/Integrations";
import { SettingsModal } from "@surfaces/settings/SettingsModal";
import { CommandPalette } from "@surfaces/command/CommandPalette";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { ContentPanel } from "./ContentPanel";

const VIEWS: Record<NavId, ComponentType> = {
  home: Home,
  insights: Insights,
  chat: Chat,
  notes: Notes,
  upload: Upload,
  dictionary: Dictionary,
  transforms: Transforms,
  integrations: Integrations,
};

/** The primary desktop window: title bar + sidebar + floating content panel. */
export function ControlPanel() {
  const activeView = useUiStore((s) => s.activeView);
  const View = VIEWS[activeView];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const state = useUiStore.getState();
        state.setPaletteOpen(!state.paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="flex h-full flex-col bg-canvas"
      data-eval="app-shell"
      data-eval-view={activeView}
      data-eval-ready="true"
    >
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <ContentPanel view={activeView}>
          <View />
        </ContentPanel>
      </div>
      <SettingsModal />
      <CommandPalette />
    </div>
  );
}
