import { useState } from "react";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card } from "@components/ui/card";
import { Tabs } from "@components/ui/tabs";

type WorkspaceTab = "members" | "teams";

const MEMBERS = [
  { name: "You", email: "you@example.com", role: "Owner" },
  { name: "Alex Rivera", email: "alex@example.com", role: "Admin" },
  { name: "Sam Lee", email: "sam@example.com", role: "Member" },
];

const TEAMS = [
  { name: "Design", count: 4 },
  { name: "Platform", count: 6 },
];

export function WorkspaceSettings() {
  const [tab, setTab] = useState<WorkspaceTab>("members");

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "members", label: "Members" },
          { value: "teams", label: "Teams" },
        ]}
      />

      <div className="my-4 flex justify-end">
        <Button size="sm">{tab === "members" ? "Invite" : "Create team"}</Button>
      </div>

      {tab === "members" ? (
        <Card className="divide-y divide-border-subtle">
          {MEMBERS.map((member) => (
            <div key={member.email} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-xs font-semibold text-accent">
                {member.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <Badge variant="neutral">{member.role}</Badge>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="divide-y divide-border-subtle">
          {TEAMS.map((team) => (
            <div key={team.name} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm font-semibold text-foreground">{team.name}</span>
              <span className="text-xs text-muted-foreground">{team.count} members</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
