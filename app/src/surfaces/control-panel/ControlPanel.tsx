import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { NAV_ITEMS, type NavId } from "@config/nav";
import { useUiStore } from "@stores/ui";
import { Home } from "@features/home/Home";
import { Chat } from "@features/chat/Chat";
import { Notes } from "@features/notes/Notes";
import { SettingsModal } from "@surfaces/settings/SettingsModal";
import { CommandPalette } from "@surfaces/command/CommandPalette";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { ContentPanel } from "./ContentPanel";

// Home/Chat/Notes are the daily-driver views and stay in the initial bundle. The rest are used less
// often, so they're code-split off the first paint and preloaded once the shell is interactive (see
// the preload effect below) -- so they cost nothing at launch yet still open instantly.
const Insights = lazy(() => import("@features/insights/Insights").then((m) => ({ default: m.Insights })));
const Upload = lazy(() => import("@features/upload/Upload").then((m) => ({ default: m.Upload })));
const Dictionary = lazy(() =>
  import("@features/dictionary/Dictionary").then((m) => ({ default: m.Dictionary })),
);
const Transforms = lazy(() =>
  import("@features/transforms/Transforms").then((m) => ({ default: m.Transforms })),
);

const VIEWS: Record<NavId, ComponentType> = {
  home: Home,
  insights: Insights,
  chat: Chat,
  notes: Notes,
  upload: Upload,
  dictionary: Dictionary,
  transforms: Transforms,
};

/** Non-blank placeholder shown only if a code-split view is opened before its chunk has loaded. */
function ViewFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
  );
}

/** Views that own the full content height and scroll internally (bordered, app-like boundary). */
const FILL_VIEWS = new Set<NavId>(["chat", "notes"]);

/** The primary desktop window: title bar + sidebar + floating content panel. */
export function ControlPanel() {
  const activeView = useUiStore((s) => s.activeView);
  const View = VIEWS[activeView];

  // Once the shell is interactive, quietly warm the code-split views in the background so the first
  // navigation to any of them is instant -- this runs after first paint, off the critical path.
  useEffect(() => {
    void import("@features/insights/Insights");
    void import("@features/upload/Upload");
    void import("@features/dictionary/Dictionary");
    void import("@features/transforms/Transforms");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const state = useUiStore.getState();
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        state.setPaletteOpen(!state.paletteOpen);
      } else if (key === ",") {
        e.preventDefault();
        state.openSettings();
      } else if (/^[1-9]$/.test(e.key)) {
        const item = NAV_ITEMS[Number(e.key) - 1];
        if (item) {
          e.preventDefault();
          state.setActiveView(item.id);
        }
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
        <ContentPanel view={activeView} fill={FILL_VIEWS.has(activeView)}>
          <Suspense fallback={<ViewFallback />}>
            <View />
          </Suspense>
        </ContentPanel>
      </div>
      <SettingsModal />
      <CommandPalette />
    </div>
  );
}
