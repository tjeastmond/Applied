"use client";

import { ArchivedViewToggle } from "@/components/ArchivedViewToggle";
import { CompanyFilter } from "@/components/CompanyFilter";
import { StatusFilter } from "@/components/StatusFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ANALYTICS_RANGE_OPTIONS,
  hasActiveAnalyticsFilters,
  isInvalidAnalyticsDateRange,
  type AnalyticsFilters as AnalyticsFilterState,
  type AnalyticsRange,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types";
import { ChevronDownIcon, XIcon } from "lucide-react";

type AnalyticsFiltersProps = {
  companies: string[];
  filters: AnalyticsFilterState;
  onRangeChange: (range: AnalyticsRange) => void;
  onCompaniesChange: (companies: Set<string>) => void;
  onStatusesChange: (statuses: Set<ApplicationStatus>) => void;
  onIncludeArchivedChange: (includeArchived: boolean) => void;
  onDateChange: (field: "from" | "to", value: string) => void;
  onClearFilters: () => void;
};

export function AnalyticsFilters({
  companies,
  filters,
  onRangeChange,
  onCompaniesChange,
  onStatusesChange,
  onIncludeArchivedChange,
  onDateChange,
  onClearFilters,
}: AnalyticsFiltersProps) {
  const hasActiveFilters = hasActiveAnalyticsFilters(filters);
  const invalidDateRange = isInvalidAnalyticsDateRange(filters);

  return (
    <section aria-labelledby="analytics-filters-heading" className="space-y-3">
      <h2 id="analytics-filters-heading" className="sr-only">
        Analytics Filters
      </h2>
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <label className="relative min-w-0">
          <span className="sr-only">Date range</span>
          <select
            value={filters.range}
            onChange={(event) => onRangeChange(event.target.value as AnalyticsRange)}
            className="border-input bg-background dark:bg-input/30 h-10 w-full appearance-none rounded-md border px-2.5 pr-8 text-sm outline-none focus:border-blue-500 sm:h-8"
            aria-label="Date Range"
          >
            {ANALYTICS_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
        </label>
        <CompanyFilter
          companies={companies}
          selectedCompanies={new Set(filters.companies)}
          onSelectedCompaniesChange={onCompaniesChange}
          disabled={companies.length === 0}
          className="h-10 sm:h-8"
        />
        <StatusFilter
          selectedStatuses={new Set(filters.statuses)}
          onSelectedStatusesChange={onStatusesChange}
          className="h-10 sm:h-8"
        />
        <ArchivedViewToggle
          includeArchived={filters.includeArchived}
          onIncludeArchivedChange={onIncludeArchivedChange}
          className="h-10 w-full justify-center sm:h-8 sm:w-auto"
        />
        <span
          className={cn(
            "inline-flex justify-self-start sm:justify-self-end",
            !hasActiveFilters && "cursor-not-allowed",
          )}
          title={hasActiveFilters ? "Clear filters" : "No active filters"}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasActiveFilters}
            className={cn(
              "size-10 active:translate-y-0 sm:size-8",
              !hasActiveFilters && "[&_svg]:text-muted-foreground disabled:opacity-100",
              hasActiveFilters &&
                "border-border bg-destructive/45 hover:border-border hover:bg-destructive/55 dark:border-input dark:bg-destructive/50 dark:hover:border-input dark:hover:bg-destructive/60 text-white hover:text-white [&_svg]:text-white",
            )}
            onClick={onClearFilters}
            aria-label="Clear filters"
          >
            <XIcon />
          </Button>
        </span>
      </div>

      {filters.range === "custom" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">From</span>
            <Input
              type="date"
              value={filters.from ?? ""}
              max={filters.to}
              aria-invalid={invalidDateRange}
              onChange={(event) => onDateChange("from", event.target.value)}
              className="h-10 w-full sm:h-8 sm:w-40"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">To</span>
            <Input
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              aria-invalid={invalidDateRange}
              onChange={(event) => onDateChange("to", event.target.value)}
              className="h-10 w-full sm:h-8 sm:w-40"
            />
          </label>
          {invalidDateRange ? (
            <p className="text-destructive self-end pb-1 text-xs" role="status">
              From date must be on or before To date.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
