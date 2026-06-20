import { useState } from "react";
import { Blocks, Calendar, Code2, Terminal, type LucideIcon } from "lucide-react";
import { useServices } from "@services";
import type { Integration } from "@services/ports";
import { PageHeader } from "@components/common/PageHeader";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";

const ICONS: Record<Integration["icon"], LucideIcon> = {
  calendar: Calendar,
  code: Code2,
  blocks: Blocks,
  terminal: Terminal,
};

const CONNECT_LABEL: Record<string, string> = {
  gcal: "Connect",
  api: "Manage",
  mcp: "Set up",
  cli: "Set up",
};

export function Integrations() {
  const { content } = useServices();
  const [integrations, setIntegrations] = useState<Integration[]>(() => content.integrations());

  function toggle(id: string) {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "connected" ? "disconnected" : "connected" }
          : item,
      ),
    );
  }

  return (
    <div>
      <PageHeader title="Integrations" description="Connect Khonjel to the tools you already use." />

      <div className="flex flex-col gap-3">
        {integrations.map((item) => {
          const Icon = ICONS[item.icon];
          const connected = item.status === "connected";
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 rounded-md border border-border bg-surface p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-foreground">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.name}</span>
                  {connected ? <Badge variant="success">Connected</Badge> : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {connected && item.detail ? item.detail : item.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {connected ? (
                  <>
                    <Button variant="secondary" size="sm">
                      Manage
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle(item.id)}
                      className="text-muted-foreground hover:text-danger"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => toggle(item.id)}>
                    {CONNECT_LABEL[item.id] ?? "Connect"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
