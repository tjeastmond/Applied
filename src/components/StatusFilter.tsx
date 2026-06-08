"use client";

import { memo, useMemo } from "react";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import {
  APPLICATION_STATUS_OPTIONS,
  statusDotClassName,
  statusLabel,
  type ApplicationStatus,
} from "@/lib/applicationStatus";
import { cn } from "@/lib/utils";

export const StatusFilter = memo(function StatusFilter({
  selectedStatuses,
  onSelectedStatusesChange,
  className,
}: {
  selectedStatuses: Set<ApplicationStatus>;
  onSelectedStatusesChange: (next: Set<ApplicationStatus>) => void;
  className?: string;
}) {
  const items = useMemo(
    () =>
      APPLICATION_STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: (
          <>
            <span className={cn("size-2 shrink-0 rounded-full", statusDotClassName(option.value))} />
            {option.label}
          </>
        ),
      })),
    [],
  );

  return (
    <MultiSelectFilter
      items={items}
      selected={selectedStatuses}
      onSelectedChange={onSelectedStatusesChange}
      emptyLabel="Filter by status"
      pluralNoun="statuses"
      groupLabel="Status"
      formatSingleLabel={statusLabel}
      className={className}
    />
  );
});
