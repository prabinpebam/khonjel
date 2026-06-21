import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { useServices } from "@services";
import type { InsightsAggregate } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { EMPTY_INSIGHTS } from "@lib/defaults";
import { PageHeader } from "@components/common/PageHeader";
import { StatCard } from "@components/common/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Tabs } from "@components/ui/tabs";
import { formatNumber } from "@lib/format";
import { cn } from "@lib/utils";

type InsightsTab = "usage" | "voice";

export function Insights() {
  const { content } = useServices();
  const data = useAsync(() => content.insights(), EMPTY_INSIGHTS);
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
              valueClassName="text-cat-insights"
            />
            <StatCard
              value={formatNumber(data.wordsCorrected + data.dictionaryFixes)}
              label="Fixes made"
              sub={`${data.wordsCorrected} corrected · ${data.dictionaryFixes} dictionary`}
              valueClassName="text-cat-transforms"
            />
            <StatCard
              value={formatNumber(data.totalWords)}
              label="Total words dictated"
              sub="Desktop"
              valueClassName="text-cat-home"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Desktop usage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.appUsage.map((row, index) => (
                <div key={row.category} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm text-foreground">
                    {row.category}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-sm bg-surface-2">
                    <div
                      className={cn("h-full rounded-sm", BAR_COLORS[index % BAR_COLORS.length])}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-tertiary-foreground">
                    {row.pct}% · {row.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <StreakCalendar data={data} />
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

const BAR_COLORS = [
  "bg-cat-home",
  "bg-cat-insights",
  "bg-cat-chat",
  "bg-cat-notes",
  "bg-cat-transforms",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StreakCalendar({ data }: { data: InsightsAggregate }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => {
    const result: { date: string; count: number }[][] = [];
    for (let i = 0; i < data.heatmap.length; i += 7) {
      result.push(data.heatmap.slice(i, i + 7));
    }
    return result;
  }, [data.heatmap]);

  const monthLabels = useMemo(
    () =>
      weeks.map((week, index) => {
        const first = week[0];
        if (!first) return "";
        const month = new Date(`${first.date}T00:00:00`).getMonth();
        const prevFirst = index > 0 ? weeks[index - 1]?.[0] : undefined;
        const prevMonth = prevFirst ? new Date(`${prevFirst.date}T00:00:00`).getMonth() : -1;
        return index > 0 && month !== prevMonth ? (MONTHS[month] ?? "") : "";
      }),
    [weeks],
  );

  const scroll = (delta: number) =>
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{data.streak.current} day streak</h3>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Longest streak | {data.streak.longest} days
        </span>
      </div>

      <div className="mt-4 flex items-start gap-2">
        <button
          type="button"
          aria-label="Scroll earlier"
          onClick={() => scroll(-160)}
          className="mt-5 text-tertiary-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex w-max gap-2 pe-2">
            <div className="flex flex-col gap-1 pt-5">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="flex h-3.5 items-center text-xs leading-none text-tertiary-foreground"
                >
                  {day}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {weeks.map((week, index) => (
                <div key={week[0]?.date ?? index} className="flex flex-col gap-1">
                  <span className="h-4 w-0 whitespace-nowrap text-xs text-tertiary-foreground">
                    {monthLabels[index]}
                  </span>
                  {week.map((cell) => (
                    <span
                      key={cell.date}
                      title={`${cell.date}: ${cell.count}`}
                      className={cn("size-3.5 rounded-xs", heatColor(cell.count))}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Scroll later"
          onClick={() => scroll(160)}
          className="mt-5 text-tertiary-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>More</span>
        <span className="size-3.5 rounded-xs bg-dataviz" />
        <span className="size-3.5 rounded-xs bg-dataviz/80" />
        <span className="size-3.5 rounded-xs bg-dataviz/55" />
        <span className="size-3.5 rounded-xs bg-dataviz/30" />
        <span>Less</span>
      </div>
    </Card>
  );
}

function heatColor(count: number): string {
  if (count <= 0) return "bg-foreground/10";
  if (count === 1) return "bg-dataviz/30";
  if (count === 2) return "bg-dataviz/55";
  if (count === 3) return "bg-dataviz/80";
  return "bg-dataviz";
}
