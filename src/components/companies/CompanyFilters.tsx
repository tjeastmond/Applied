"use client";

import { memo, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTER_ROW_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import { SearchIcon, XIcon } from "lucide-react";

export const CompanyFilters = memo(function CompanyFilters({
  searchQuery,
  onSearchQueryChange,
  onClearFilters,
  hasActiveFilters,
  searchInputRef,
  className,
}: {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className={FILTER_ROW_CLASS}>
        <div className="relative min-w-0 flex-1">
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
