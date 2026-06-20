import { NAV_ITEMS } from "@config/nav";
import { useUiStore } from "@stores/ui";
import { Home } from "@features/home/Home";
import { Placeholder } from "@components/common/Placeholder";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { ContentPanel } from "./ContentPanel";

/** The primary desktop window: title bar + sidebar + floating content panel. */
export function ControlPanel() {
  const activeView = useUiStore((s) => s.activeView);
  const current = NAV_ITEMS.find((item) => item.id === activeView);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <ContentPanel>
          {activeView === "home" ? <Home /> : <Placeholder title={current?.label ?? "Soon"} />}
        </ContentPanel>
      </div>
    </div>
  );
}
