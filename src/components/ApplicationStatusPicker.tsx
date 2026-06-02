"use client";

import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  APPLICATION_STATUS_OPTIONS,
  statusDotClassName,
  statusLabel,
  statusTagClassName,
  type ApplicationStatus,
} from "@/lib/applicationStatus";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";

export function ApplicationStatusPicker({
  status,
  onStatusChange,
  disabled = false,
  className,
}: {
  status: ApplicationStatus;
  onStatusChange: (status: ApplicationStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [displayStatus, setDisplayStatus] = useState(status);

  useEffect(() => {
    setDisplayStatus(status);
  }, [status]);

  function stopCardClick(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  function handleStatusSelect(value: string) {
    if (!value || value === displayStatus) {
      setOpen(false);
      return;
    }

    const nextStatus = value as ApplicationStatus;
    setDisplayStatus(nextStatus);
    onStatusChange(nextStatus);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 aria-expanded:ring-2 disabled:pointer-events-none disabled:opacity-50",
          statusTagClassName(displayStatus),
          className,
        )}
        onClick={stopCardClick}
        onPointerDown={stopCardClick}
      >
        {statusLabel(displayStatus)}
        <ChevronDownIcon className="size-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 rounded-md" onClick={stopCardClick}>
        <DropdownMenuRadioGroup value={displayStatus} onValueChange={handleStatusSelect}>
          {APPLICATION_STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-sm"
              onClick={() => setOpen(false)}
            >
              <span className={cn("size-2 shrink-0 rounded-full", statusDotClassName(option.value))} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
