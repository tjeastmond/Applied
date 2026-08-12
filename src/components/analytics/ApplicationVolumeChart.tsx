"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { ChartColumnIncreasingIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  analyticsRelativeBarScale,
  analyticsVolumeLabelIndexes,
  formatAnalyticsVolumeTickLabel,
  type AnalyticsResponse,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

type VolumeBucket = AnalyticsResponse["volume"][number];

const DENSE_DAILY_BUCKET_COUNT = 24;
export const DENSE_VOLUME_BAR_WIDTH_CLASS = "w-[min(100%,0.75rem)]";
export const SPARSE_VOLUME_BAR_WIDTH_CLASS = "w-[min(100%,2rem)]";

export function applicationVolumeBarWidthClass(volume: readonly VolumeBucket[]): string {
  const isDenseDailyCohort =
    volume.length >= DENSE_DAILY_BUCKET_COUNT && volume.every((bucket) => bucket.bucketStart === bucket.bucketEnd);

  return isDenseDailyCohort ? DENSE_VOLUME_BAR_WIDTH_CLASS : SPARSE_VOLUME_BAR_WIDTH_CLASS;
}

function dateRangeLabel(bucket: VolumeBucket): string {
  return bucket.bucketStart === bucket.bucketEnd
    ? bucket.bucketStart
    : `${bucket.bucketStart} through ${bucket.bucketEnd}`;
}

export function ApplicationVolumeChart({ volume }: { volume: VolumeBucket[] }) {
  const maximum = Math.max(1, ...volume.map((bucket) => bucket.count));
  const barWidthClass = applicationVolumeBarWidthClass(volume);
  const visibleLabelIndexes = analyticsVolumeLabelIndexes(volume.length);
  const ticks = [...visibleLabelIndexes].map((bucketIndex) => ({
    bucket: volume[bucketIndex],
    bucketIndex,
  }));
  const bucketGridStyle = {
    gridTemplateColumns: `repeat(${volume.length}, minmax(0, 1fr))`,
    columnGap: "clamp(1px, 0.45vw, 4px)",
  };

  return (
    <Card className="min-w-0">
      <CardHeader className="border-b">
        <CardTitle id="application-volume-title" className="flex items-center gap-2">
          <ChartColumnIncreasingIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          Application Volume
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <figure aria-labelledby="application-volume-title" className="min-w-0">
          <Tooltip.Provider delay={50} closeDelay={100}>
            <div
              className="min-w-0 pb-2"
              role="group"
              aria-label={`Application volume across ${volume.length} time buckets`}
            >
              <div
                data-testid="application-volume-plot"
                className="border-border grid h-56 min-w-0 border-b px-2 sm:h-64 sm:px-3"
                style={bucketGridStyle}
              >
                {volume.map((bucket) => {
                  const scale = analyticsRelativeBarScale(bucket.count, maximum);
                  return (
                    <Tooltip.Root key={`${bucket.bucketStart}-${bucket.bucketEnd}`}>
                      <Tooltip.Trigger
                        type="button"
                        className="group focus-visible:ring-offset-background flex h-full w-full min-w-0 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        aria-label={`${bucket.label}: ${bucket.count} ${bucket.count === 1 ? "application" : "applications"}`}
                      >
                        <span
                          aria-hidden
                          data-volume-bar
                          className={cn(
                            "application-volume-bar block rounded-t-[3px]",
                            barWidthClass,
                            bucket.count === 0
                              ? "h-0 bg-transparent dark:bg-transparent"
                              : "bg-chart-3 group-hover:bg-chart-4 group-focus-visible:bg-chart-4 dark:bg-chart-2",
                          )}
                          style={bucket.count === 0 ? undefined : { height: `${scale * 100}%` }}
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Positioner
                          side="top"
                          sideOffset={8}
                          collisionPadding={8}
                          collisionAvoidance={{
                            side: "flip",
                            align: "shift",
                            fallbackAxisSide: "none",
                          }}
                          className="z-50"
                        >
                          <Tooltip.Popup className="bg-popover text-popover-foreground w-max max-w-48 rounded-md border px-2 py-1 text-[0.65rem] shadow-md">
                            <span className="block font-medium">{bucket.label}</span>
                            <span className="text-muted-foreground">
                              {bucket.count} {bucket.count === 1 ? "application" : "applications"}
                            </span>
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  );
                })}
              </div>
              <div className="relative mx-2 h-7 min-w-0 pt-2 sm:mx-3" aria-hidden>
                {ticks.map(({ bucket, bucketIndex }, tickIndex) => (
                  <span
                    key={`${bucket.bucketStart}-${bucket.bucketEnd}`}
                    data-volume-tick
                    className={cn(
                      "text-muted-foreground absolute top-2 block text-[0.6rem] whitespace-nowrap tabular-nums",
                      tickIndex === 0
                        ? "translate-x-0"
                        : tickIndex === ticks.length - 1
                          ? "-translate-x-full"
                          : "-translate-x-1/2",
                      (tickIndex === 1 || tickIndex === ticks.length - 2) && "hidden min-[480px]:block",
                    )}
                    style={{
                      left: `${volume.length <= 1 ? 0 : (bucketIndex / (volume.length - 1)) * 100}%`,
                    }}
                  >
                    {formatAnalyticsVolumeTickLabel(bucket.bucketStart)}
                  </span>
                ))}
              </div>
            </div>
          </Tooltip.Provider>
        </figure>

        <table className="sr-only table-fixed">
          <caption>Application volume data</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Date Range</th>
              <th scope="col">Applications</th>
            </tr>
          </thead>
          <tbody>
            {volume.map((bucket) => (
              <tr key={`${bucket.bucketStart}-${bucket.bucketEnd}`}>
                <th scope="row">{bucket.label}</th>
                <td>{dateRangeLabel(bucket)}</td>
                <td>{bucket.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
