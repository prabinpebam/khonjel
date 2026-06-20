import { Bell, Minus, PanelLeft, Square, X } from "lucide-react";
import { Button } from "@components/ui/button";

/**
 * Window chrome (52px). In the mock the controls are inert; in the desktop app the
 * left region is the OS drag handle and the right cluster drives window IPC.
 */
export function TitleBar() {
  return (
    <header className="app-drag flex h-[var(--titlebar-height)] shrink-0 items-center justify-between bg-canvas ps-2 pe-2">
      <div className="app-no-drag flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Toggle sidebar">
          <PanelLeft />
        </Button>
      </div>
      <div className="app-no-drag flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Minimize"
          onClick={() => window.electronAPI?.minimize?.()}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Maximize"
          onClick={() => window.electronAPI?.toggleMaximize?.()}
        >
          <Square />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => window.electronAPI?.close?.()}
        >
          <X />
        </Button>
      </div>
    </header>
  );
}
