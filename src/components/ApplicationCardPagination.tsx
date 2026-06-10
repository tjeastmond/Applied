"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FILTER_CONTROL_HEIGHT_CLASS } from "@/lib/filterControls";
import {
  APPLICATION_PAGE_SIZE_OPTIONS,
  APPLICATION_VIEW_ALL_PAGE_SIZE,
  applicationPageSizeMenuLabel,
  applicationPageSizeTriggerLabel,
  formatApplicationPageRange,
  type ApplicationPageSize,
} from "@/lib/applicationPagination";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type ApplicationCardPaginationProps = {
  page: number;
  pageSize: ApplicationPageSize;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ApplicationPageSize) => void;
  className?: string;
};

export const ApplicationCardPagination = memo(function ApplicationCardPagination({
  page,
  pageSize,
  totalPages,
  rangeStart,
  rangeEnd,
  totalCount,
  onPageChange,
  onPageSizeChange,
  className,
}: ApplicationCardPaginationProps) {
  if (totalCount === 0) return null;

  return (
    <nav
      aria-label="Application list pagination"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-muted-foreground text-sm tabular-nums">
        {formatApplicationPageRange(rangeStart, rangeEnd, totalCount)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(FILTER_CONTROL_HEIGHT_CLASS, "w-8 active:translate-y-0")}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-muted-foreground min-w-[5.5rem] text-center text-sm tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(FILTER_CONTROL_HEIGHT_CLASS, "w-8 active:translate-y-0")}
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className={cn(FILTER_CONTROL_HEIGHT_CLASS, "gap-1.5 px-2.5 font-normal active:translate-y-0")}
                aria-label="Change items per page"
              >
                {applicationPageSizeTriggerLabel(pageSize)}
                <ChevronDownIcon className="size-3.5 opacity-60" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Per page</DropdownMenuLabel>
              {APPLICATION_PAGE_SIZE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => onPageSizeChange(option)}
                  className={cn(option === pageSize && "bg-accent text-accent-foreground")}
                >
                  {applicationPageSizeMenuLabel(option)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onPageSizeChange(APPLICATION_VIEW_ALL_PAGE_SIZE)}
                className={cn(pageSize === APPLICATION_VIEW_ALL_PAGE_SIZE && "bg-accent text-accent-foreground")}
              >
                {applicationPageSizeMenuLabel(APPLICATION_VIEW_ALL_PAGE_SIZE)}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
});
