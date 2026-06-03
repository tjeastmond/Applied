"use client";

import { memo, type RefObject } from "react";
import { CompanyFilter } from "@/components/CompanyFilter";
import { StatusFilter } from "@/components/StatusFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTER_ROW_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import { SearchIcon, XIcon } from "lucide-react";
import type { ApplicationStatus } from "@/types";

export const ApplicationFilters = memo(function ApplicationFilters({
  companies,
  selectedCompanies,
  onSelectedCompaniesChange,
  selectedStatuses,
  onSelectedStatusesChange,
  searchQuery,
  onSearchQueryChange,
  onClearFilters,
  hasActiveFilters,
  searchInputRef,
  className,
}: {
  companies: string[];
  selectedCompanies: Set<string>;
  onSelectedCompaniesChange: (next: Set<string>) => void;
  selectedStatuses: Set<ApplicationStatus>;
  onSelectedStatusesChange: (next: Set<ApplicationStatus>) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search applications…"
          className="pl-8"
          aria-label="Search applications"
        />
      </div>
      <div className={FILTER_ROW_CLASS}>
        <CompanyFilter
          companies={companies}
          selectedCompanies={selectedCompanies}
          onSelectedCompaniesChange={onSelectedCompaniesChange}
          disabled={companies.length === 0}
        />
        <StatusFilter
          selectedStatuses={selectedStatuses}
          onSelectedStatusesChange={onSelectedStatusesChange}
        />
        <span
          className={cn("inline-flex shrink-0", !hasActiveFilters && "cursor-not-allowed")}
          title={hasActiveFilters ? "Clear filters" : "No active filters"}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!hasActiveFilters}
            className={cn(
              "active:translate-y-0",
              !hasActiveFilters && "disabled:opacity-100 [&_svg]:text-muted-foreground",
              hasActiveFilters &&
                "border-border bg-destructive/20 text-white hover:border-border hover:bg-destructive/25 hover:text-white [&_svg]:text-white dark:border-input dark:hover:border-input",
            )}
            onClick={onClearFilters}
            aria-label="Clear filters"
          >
            <XIcon />
          </Button>
        </span>
      </div>
    </div>
  );
});
