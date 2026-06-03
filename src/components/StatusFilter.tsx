"use client";

import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  APPLICATION_STATUS_OPTIONS,
  statusDotClassName,
  statusLabel,
  type ApplicationStatus,
} from "@/lib/applicationStatus";
import { toggleStatusSelection } from "@/lib/statusFilter";
import { FILTER_TRIGGER_BUTTON_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";

export const StatusFilter = memo(function StatusFilter({
  selectedStatuses,
  onSelectedStatusesChange,
  className,
}: {
  selectedStatuses: Set<ApplicationStatus>;
  onSelectedStatusesChange: (next: Set<ApplicationStatus>) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = selectedStatuses.size;
  const singleStatus = activeCount === 1 ? selectedStatuses.values().next().value : undefined;
  const label =
    activeCount === 0
      ? "Filter by status"
      : activeCount === 1 && singleStatus
        ? statusLabel(singleStatus)
        : `${activeCount} statuses`;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="default"
            className={cn(FILTER_TRIGGER_BUTTON_CLASS, className)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <ListFilterIcon className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDownIcon
              className={cn(
                "size-3.5 shrink-0 opacity-70 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {APPLICATION_STATUS_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedStatuses.has(option.value)}
              onCheckedChange={(checked) =>
                onSelectedStatusesChange(
                  toggleStatusSelection(selectedStatuses, option.value, checked === true),
                )
              }
            >
              <span className={cn("size-2 shrink-0 rounded-full", statusDotClassName(option.value))} />
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
