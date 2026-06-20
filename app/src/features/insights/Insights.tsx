import { useState } from "react";
import { Share2 } from "lucide-react";
import { useServices } from "@services";
import { PageHeader } from "@components/common/PageHeader";
import { StatCard } from "@components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Tabs } from "@components/ui/tabs";
import { formatNumber } from "@lib/format";
import { cn } from "@lib/utils";

type InsightsTab = "usage" | "voice";

export function Insights() {
  const { content } = useServices();
  const data = content.insights();
  const [tab, setTab] = useState<InsightsTab>("usage");

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Gamified analytics from your local data."
        actions={
          <span className="grid size-12 place-items-center rounded-pill bg-dataviz text-primary-foreground">
            <Share2 className="size-5" />
          </span>
        }
      />

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: "usage", label: "Your Usage" },
          { value: "voice", label: "Your Voice" },
        ]}
      />

      {tab === "usage" ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              value={formatNumber(data.wpm)}
              label="Words / minute"
              sub={`Top ${(100 - data.wpmPercentile).toFixed(1)}%`}
            />
            <StatCard
              value={formatNumber(data.wordsCorrected + data.dictionaryFixes)}
              label="Fixes made"
              sub={`${data.wordsCorrected} corrected · ${data.dictionaryFixes} dictionary`}
            />
            <StatCard value={formatNumber(data.totalWords)} label="Total words dictated" sub="Desktop" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Desktop usage</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {data.appUsage.map((row) => (
                  <div key={row.category} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-sm text-foreground">
                      {row.category}
                    </span>
                    <div className="h-6 flex-1 overflow-hidden rounded-sm bg-surface-2">
                      <div className="h-full rounded-sm bg-dataviz" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-tertiary-foreground">
                      {row.pct}% · {row.count}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-flow-col grid-rows-[repeat(7,minmax(0,1fr))] gap-1">
                  {data.heatmap.map((cell) => (
                    <span
                      key={cell.date}
                      title={`${cell.date}: ${cell.count}`}
                      className={cn("size-3 rounded-sm", heatColor(cell.count))}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Current streak{" "}
                  <span className="font-semibold text-foreground">{data.streak.current} day</span> ·
                  Longest{" "}
                  <span className="font-semibold text-foreground">{data.streak.longest} days</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Speaking pace, filler-rate trends, and vocabulary growth arrive in a later phase.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function heatColor(count: number): string {
  if (count <= 0) return "bg-border";
  if (count === 1) return "bg-dataviz/30";
  if (count === 2) return "bg-dataviz/55";
  if (count === 3) return "bg-dataviz/80";
  return "bg-dataviz";
}
