"use client";

import { CompanyFilter } from "@/components/CompanyFilter";
import { SingleSelectFilter } from "@/components/SingleSelectFilter";
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
import { FILTER_CONTROL_HEIGHT_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types";
import { CalendarIcon, XIcon } from "lucide-react";

type AnalyticsFiltersProps = {
  companies: string[];
  filters: AnalyticsFilterState;
  onRangeChange: (range: AnalyticsRange) => void;
  onCompaniesChange: (companies: Set<string>) => void;
  onStatusesChange: (statuses: Set<ApplicationStatus>) => void;
  onDateChange: (field: "from" | "to", value: string) => void;
  onClearFilters: () => void;
};

export function AnalyticsFilters({
  companies,
  filters,
  onRangeChange,
  onCompaniesChange,
  onStatusesChange,
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
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <SingleSelectFilter
          items={ANALYTICS_RANGE_OPTIONS}
          value={filters.range}
          onValueChange={onRangeChange}
          groupLabel="Date Range"
          ariaLabel="Date Range"
          leadingIcon={<CalendarIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />}
          className={FILTER_CONTROL_HEIGHT_CLASS}
        />
        <CompanyFilter
          companies={companies}
          selectedCompanies={new Set(filters.companies)}
          onSelectedCompaniesChange={onCompaniesChange}
          disabled={companies.length === 0}
          className={FILTER_CONTROL_HEIGHT_CLASS}
        />
        <StatusFilter
          selectedStatuses={new Set(filters.statuses)}
          onSelectedStatusesChange={onStatusesChange}
          className={FILTER_CONTROL_HEIGHT_CLASS}
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
              "active:translate-y-0",
              FILTER_CONTROL_HEIGHT_CLASS,
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
              onChange={(event) => {
                onDateChange("from", event.currentTarget.value);
                if (event.currentTarget.value && event.currentTarget.checkValidity()) {
                  event.currentTarget.blur();
                }
              }}
              className={cn("w-full sm:w-40", FILTER_CONTROL_HEIGHT_CLASS)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">To</span>
            <Input
              type="date"
              value={filters.to ?? ""}
              min={filters.from}
              aria-invalid={invalidDateRange}
              onChange={(event) => {
                onDateChange("to", event.currentTarget.value);
                if (event.currentTarget.value && event.currentTarget.checkValidity()) {
                  event.currentTarget.blur();
                }
              }}
              className={cn("w-full sm:w-40", FILTER_CONTROL_HEIGHT_CLASS)}
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
