"use client";

import { useEffect, useState } from "react";
import { ActivityIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusDotClassName } from "@/lib/applicationStatus";
import {
  analyticsRelativeBarScale,
  analyticsStatusesByActivity,
  formatAnalyticsRate,
  type AnalyticsResponse,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types";

export function CurrentStatusCard({
  status,
  selectedStatuses,
  onStatusSelect,
}: {
  status: AnalyticsResponse["status"];
  selectedStatuses: ReadonlySet<ApplicationStatus>;
  onStatusSelect: (status: ApplicationStatus) => void;
}) {
  const [barsVisible, setBarsVisible] = useState(false);
  const statusByValue = new Map(status.map((item) => [item.status, item]));
  const largestCount = Math.max(1, ...status.map((item) => item.count));
  const sortedStatusOptions = analyticsStatusesByActivity(status);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => setBarsVisible(true));
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <Card className="h-96 min-h-0">
      <CardHeader className="border-b">
        <CardTitle id="current-status-title" className="flex items-center gap-2">
          <ActivityIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          Current Status
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2" aria-labelledby="current-status-title">
          {sortedStatusOptions.map((option) => {
            const item = statusByValue.get(option.value);
            const count = item?.count ?? 0;
            const percentage = item?.percentage ?? (count === 0 ? 0 : null);
            const isSelected = selectedStatuses.has(option.value);

            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => onStatusSelect(option.value)}
                  className={cn(
                    "hover:bg-muted/60 focus-visible:ring-ring/50 grid min-h-11 w-full grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)_12ch] items-center gap-3 rounded-md px-1 py-2 text-left transition-colors outline-none focus-visible:ring-2",
                    isSelected && "bg-primary/5 dark:bg-primary/10",
                  )}
                  aria-label={`${isSelected ? "Remove" : "Filter by"} ${option.label}: ${count} applications, ${formatAnalyticsRate(percentage)}`}
                  aria-pressed={isSelected}
                >
                  <span className="flex items-center gap-2 text-xs">
                    <span
                      className={cn("size-2.5 shrink-0 rounded-full", statusDotClassName(option.value))}
                      aria-hidden
                    />
                    <span>{option.label}</span>
                  </span>
                  <span className="bg-muted h-2 overflow-hidden rounded-full">
                    <span
                      className={cn(
                        "block h-full w-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none",
                        statusDotClassName(option.value),
                      )}
                      style={{
                        transform: `scaleX(${barsVisible ? analyticsRelativeBarScale(count, largestCount) : 0})`,
                      }}
                      role="progressbar"
                      aria-label={`${option.label} share`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage ?? 0}
                    />
                  </span>
                  <span
                    className="text-muted-foreground grid w-[12ch] shrink-0 grid-cols-[minmax(3ch,1fr)_1ch_6ch] items-baseline gap-x-[0.5ch] text-xs whitespace-nowrap tabular-nums"
                    data-status-statistics
                  >
                    <span className="text-foreground text-right font-medium" data-status-count>
                      {count}
                    </span>
                    <span className="text-center" aria-hidden data-status-separator>
                      ·
                    </span>
                    <span className="text-right" data-status-percentage>
                      {formatAnalyticsRate(percentage)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
