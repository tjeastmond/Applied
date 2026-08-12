"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getAnalytics } from "@/api";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ApplicationVolumeChart } from "@/components/analytics/ApplicationVolumeChart";
import { CompanyPerformanceTable } from "@/components/analytics/CompanyPerformanceTable";
import { CurrentStatusCard } from "@/components/analytics/CurrentStatusCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  analyticsFiltersToUrl,
  analyticsFiltersToSearchParams,
  defaultAnalyticsFilters,
  formatAnalyticsCount,
  formatAnalyticsRate,
  isIncompleteAnalyticsDateRange,
  isInvalidAnalyticsDateRange,
  parseAnalyticsFilters,
  toggleAnalyticsStatusFromPane,
  type AnalyticsFilters as AnalyticsFilterState,
  type AnalyticsRange,
  type AnalyticsResponse,
} from "@/lib/analytics";
import { errorMessage } from "@/lib/errorMessage";
import { SHELL_LIST_EDGE_BLEED_CLASS } from "@/lib/listPageLayout";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobApplication } from "@/types";
import { ActivityIcon, BriefcaseBusinessIcon, MessageSquareMoreIcon, TrophyIcon } from "lucide-react";

type AnalyticsPageProps = {
  applications: JobApplication[];
  onAddApplication: () => void;
};

type AnalyticsFilterUpdate = AnalyticsFilterState | ((currentFilters: AnalyticsFilterState) => AnalyticsFilterState);

type RequestState =
  | { status: "loading"; data: null; error: null }
  | { status: "refreshing"; data: AnalyticsResponse; error: null }
  | { status: "ready"; data: AnalyticsResponse; error: null }
  | { status: "error"; data: AnalyticsResponse | null; error: Error }
  | { status: "incomplete"; data: null; error: null }
  | { status: "invalid"; data: null; error: null };

const KPI_CARD_DEFINITIONS = [
  {
    key: "applications",
    label: "Applications",
    icon: BriefcaseBusinessIcon,
  },
  {
    key: "activePipeline",
    label: "Active Pipeline",
    icon: ActivityIcon,
  },
  {
    key: "interview",
    label: "Interview Rate",
    icon: MessageSquareMoreIcon,
  },
  {
    key: "offer",
    label: "Offer Rate",
    icon: TrophyIcon,
  },
] as const;

function AnalyticsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARD_DEFINITIONS.map((card) => (
          <div key={card.key} className="bg-card ring-foreground/10 h-32 rounded-xl shadow-sm ring-1">
            <div className="space-y-4 p-4 motion-safe:animate-pulse">
              <div className="bg-muted h-3 w-28 rounded" />
              <div className="bg-muted h-8 w-20 rounded" />
              <div className="bg-muted h-3 w-36 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="bg-card ring-foreground/10 h-80 rounded-xl shadow-sm ring-1">
          <div className="bg-muted m-4 h-[calc(100%-2rem)] rounded-lg motion-safe:animate-pulse" />
        </div>
        <div className="bg-card ring-foreground/10 h-80 rounded-xl shadow-sm ring-1">
          <div className="bg-muted m-4 h-[calc(100%-2rem)] rounded-lg motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function AnalyticsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <div className="bg-muted flex size-11 items-center justify-center rounded-full" aria-hidden>
          <ActivityIcon className="text-muted-foreground size-5" />
        </div>
        <div className="max-w-lg space-y-1">
          <h2 className="font-heading text-base font-medium">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button type="button" variant="save" onClick={onAction}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function kpiValues(data: AnalyticsResponse) {
  return {
    applications: {
      value: formatAnalyticsCount(data.cohort.applications),
      helper: "In the selected date range",
    },
    activePipeline: {
      value: formatAnalyticsCount(data.cohort.activePipeline),
      helper: `${formatAnalyticsRate(data.rates.activePipeline)} of eligible applications`,
    },
    interview: {
      value: formatAnalyticsRate(data.rates.interview),
      helper: `${formatAnalyticsCount(data.cohort.interviewed)} of ${formatAnalyticsCount(data.cohort.eligible)} eligible`,
    },
    offer: {
      value: formatAnalyticsRate(data.rates.offer),
      helper: `${formatAnalyticsCount(data.cohort.offers)} of ${formatAnalyticsCount(data.cohort.eligible)} eligible`,
    },
  };
}

export function AnalyticsPage({ applications, onAddApplication }: AnalyticsPageProps) {
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const filters = useMemo(
    () => parseAnalyticsFilters(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const analyticsSearchParams = useMemo(() => analyticsFiltersToSearchParams(filters), [filters]);
  const analyticsQuery = analyticsSearchParams.toString();
  const invalidDateRange = isInvalidAnalyticsDateRange(filters);
  const incompleteDateRange = isIncompleteAnalyticsDateRange(filters);
  const [retryKey, setRetryKey] = useState(0);
  const latestRequestRef = useRef(0);
  const [requestState, setRequestState] = useState<RequestState>(() =>
    incompleteDateRange
      ? { status: "incomplete", data: null, error: null }
      : invalidDateRange
        ? { status: "invalid", data: null, error: null }
        : { status: "loading", data: null, error: null },
  );

  const companyOptions = useMemo(
    () =>
      [
        ...new Set(
          applications.map((application) => application.company?.trim()).filter((value): value is string => !!value),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [applications],
  );

  const replaceFilters = useCallback((update: AnalyticsFilterUpdate) => {
    const currentFilters = parseAnalyticsFilters(new URLSearchParams(window.location.search));
    const nextFilters = typeof update === "function" ? update(currentFilters) : update;
    window.history.replaceState(null, "", analyticsFiltersToUrl(nextFilters));
  }, []);

  useEffect(() => {
    if (serializedSearchParams !== analyticsQuery) {
      window.history.replaceState(null, "", analyticsFiltersToUrl(filters));
    }
  }, [analyticsQuery, filters, serializedSearchParams]);

  useEffect(() => {
    if (incompleteDateRange) {
      setRequestState({ status: "incomplete", data: null, error: null });
      return;
    }
    if (invalidDateRange) {
      setRequestState({ status: "invalid", data: null, error: null });
      return;
    }

    const controller = new AbortController();
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setRequestState((current) =>
      current.data
        ? { status: "refreshing", data: current.data, error: null }
        : { status: "loading", data: null, error: null },
    );
    void getAnalytics(new URLSearchParams(analyticsQuery), controller.signal)
      .then((data) => {
        if (controller.signal.aborted || requestId !== latestRequestRef.current) return;
        setRequestState({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== latestRequestRef.current) return;
        const normalizedError = error instanceof Error ? error : new Error(toastMessages.analyticsLoadFailed);
        setRequestState((current) => ({ status: "error", data: current.data, error: normalizedError }));
        toast.error(errorMessage(error, toastMessages.analyticsLoadFailed));
      });

    return () => controller.abort();
  }, [analyticsQuery, incompleteDateRange, invalidDateRange, retryKey]);

  const handleRangeChange = useCallback(
    (range: AnalyticsRange) => {
      replaceFilters((currentFilters) => ({
        ...currentFilters,
        range,
        ...(range === "custom" ? {} : { from: undefined, to: undefined }),
      }));
    },
    [replaceFilters],
  );

  const handleDateChange = useCallback(
    (field: "from" | "to", value: string) => {
      replaceFilters((currentFilters) => ({ ...currentFilters, [field]: value || undefined }));
    },
    [replaceFilters],
  );

  const handleCompaniesChange = useCallback(
    (companies: Set<string>) => {
      replaceFilters((currentFilters) => ({ ...currentFilters, companies: [...companies] }));
    },
    [replaceFilters],
  );

  const handleStatusesChange = useCallback(
    (statuses: Set<ApplicationStatus>) => {
      replaceFilters((currentFilters) => ({ ...currentFilters, statuses: [...statuses] }));
    },
    [replaceFilters],
  );

  const handleClearFilters = useCallback(() => {
    replaceFilters(defaultAnalyticsFilters());
  }, [replaceFilters]);

  const data = requestState.data;
  const values = data ? kpiValues(data) : null;
  const isRefreshing = requestState.status === "refreshing";

  return (
    <div className="w-full space-y-4">
      <div className="space-y-2">
        <header className="flex h-8 items-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        </header>

        <AnalyticsFilters
          companies={companyOptions}
          filters={filters}
          onRangeChange={handleRangeChange}
          onCompaniesChange={handleCompaniesChange}
          onStatusesChange={handleStatusesChange}
          onIncludeArchivedChange={(includeArchived) =>
            replaceFilters((currentFilters) => ({ ...currentFilters, includeArchived }))
          }
          onDateChange={handleDateChange}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div className={cn("py-3", SHELL_LIST_EDGE_BLEED_CLASS)}>
        <Separator />
      </div>

      {requestState.status === "incomplete" ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center text-center">
            <div className="max-w-md">
              <h2 className="font-heading font-medium">Choose A Custom Date Range</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Select both a From and To date. Both dates are included in the analytics range.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {requestState.status === "invalid" ? (
        <Card>
          <CardContent className="flex min-h-48 items-center justify-center text-center">
            <div className="max-w-md">
              <h2 className="font-heading font-medium">Choose A Valid Date Range</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                The From date must be on or before the To date. Analytics will update once the range is valid.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {requestState.status === "loading" ? <AnalyticsLoading /> : null}

      {requestState.status === "error" && !data ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Analytics Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              We couldn&apos;t load analytics right now. Your application data is unchanged.
            </p>
            <Button type="button" variant="outline" onClick={() => setRetryKey((current) => current + 1)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className={data ? "min-h-64" : undefined} aria-busy={requestState.status === "loading" || isRefreshing}>
        {data?.allTimeApplicationCount === 0 ? (
          <AnalyticsEmptyState
            title="No Analytics Yet"
            description="Add your first application to start tracking volume, pipeline health, and outcomes."
            actionLabel="Add Your First Application"
            onAction={onAddApplication}
          />
        ) : null}

        {data && data.allTimeApplicationCount > 0 && data.cohort.applications === 0 ? (
          <AnalyticsEmptyState
            title="No Data For These Filters"
            description="No applications match the selected date range and filters."
            actionLabel="Clear Filters"
            onAction={handleClearFilters}
          />
        ) : null}

        {data && data.cohort.applications > 0 && values ? (
          <div className="space-y-6">
            <section aria-labelledby="analytics-overview-heading">
              <h2 id="analytics-overview-heading" className="sr-only">
                Analytics Overview
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {KPI_CARD_DEFINITIONS.map((definition) => {
                  const Icon = definition.icon;
                  const item = values[definition.key];
                  return (
                    <Card key={definition.key} className="h-36">
                      <CardHeader className="shrink-0">
                        <div className="flex items-center justify-between gap-3">
                          <CardTitle className="text-muted-foreground text-xs">{definition.label}</CardTitle>
                          <Icon className="text-muted-foreground size-4" aria-hidden />
                        </div>
                      </CardHeader>
                      <CardContent className="grid min-h-0 flex-1 grid-rows-[auto_minmax(2rem,1fr)] content-start gap-2">
                        <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
                        <p className="text-muted-foreground min-h-8 text-[0.7rem] leading-4">{item.helper}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[2fr_1fr]">
              <ApplicationVolumeChart volume={data.volume} />
              <CurrentStatusCard
                status={data.status}
                selectedStatuses={new Set(filters.statuses)}
                onStatusSelect={(status) =>
                  replaceFilters((currentFilters) => ({
                    ...currentFilters,
                    statuses: toggleAnalyticsStatusFromPane(currentFilters.statuses, status),
                  }))
                }
              />
            </div>

            <CompanyPerformanceTable
              companies={data.companies}
              onCompanySelect={(company) =>
                replaceFilters((currentFilters) => ({ ...currentFilters, companies: [company] }))
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
