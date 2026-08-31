"use client";

import { memo, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FILTER_CONTROL_HEIGHT_CLASS, FILTER_ROW_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import { BanIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { COMPANIES_IGNORED_PATH, COMPANIES_PATH, type CompanyViewMode } from "@/lib/companies";

export const CompanyFilters = memo(function CompanyFilters({
  searchQuery,
  onSearchQueryChange,
  viewMode,
  onClearFilters,
  hasActiveFilters,
  searchInputRef,
  className,
}: {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  viewMode: CompanyViewMode;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const showingIgnored = viewMode === "ignored";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search companies…"
          className="pl-8"
          aria-label="Search companies"
        />
      </div>
      <div className={FILTER_ROW_CLASS}>
        <Link
          href={showingIgnored ? COMPANIES_PATH : COMPANIES_IGNORED_PATH}
          className={cn(
            FILTER_CONTROL_HEIGHT_CLASS,
            "link-plain border-border bg-background hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50 inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 font-normal transition-colors",
            showingIgnored && "border-primary/50 bg-primary/5 dark:bg-primary/10",
          )}
        >
          <Checkbox checked={showingIgnored} aria-hidden="true" tabIndex={-1} />
          <BanIcon className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">Ignored Companies</span>
        </Link>
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
              hasActiveFilters
                ? "bg-destructive/45 hover:bg-destructive/55 dark:bg-destructive/50 dark:hover:bg-destructive/60 border-destructive/60 text-white"
                : "text-muted-foreground",
            )}
            aria-label="Clear filters"
            onClick={onClearFilters}
          >
            <XIcon className="size-3.5" />
          </Button>
        </span>
      </div>
    </div>
  );
});
