"use client";

import { memo, useEffect, useState } from "react";
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

export const ApplicationStatusPicker = memo(function ApplicationStatusPicker({
  status,
  onStatusChange,
  disabled = false,
  size = "tag",
  className,
}: {
  status: ApplicationStatus;
  onStatusChange: (status: ApplicationStatus) => void;
  disabled?: boolean;
  /** `tag` — compact pill on cards; `field` — matches `h-8` form inputs in the sheet */
  size?: "tag" | "field";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [displayStatus, setDisplayStatus] = useState(status);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const isFieldSize = size === "field";

  const chevronClassName = cn(
    "shrink-0 opacity-70 transition-transform duration-200",
    isFieldSize ? "size-3.5" : "size-3",
    open && "rotate-180",
  );

  const triggerClassName = cn(
    "inline-flex cursor-pointer items-center rounded-md border px-2.5 font-medium transition-colors outline-none focus-visible:ring-3 aria-expanded:ring-2 disabled:pointer-events-none disabled:opacity-50",
    isFieldSize ? "h-8 w-full justify-between gap-2 text-sm" : "h-6 shrink-0 gap-1 text-xs",
    statusTagClassName(displayStatus),
    className,
  );

  if (!mounted) {
    return (
      <span className={triggerClassName} aria-hidden="true">
        {statusLabel(displayStatus)}
        <ChevronDownIcon className="size-3 shrink-0 opacity-70" />
      </span>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        disabled={disabled}
        className={triggerClassName}
        onClick={stopCardClick}
        onPointerDown={stopCardClick}
      >
        {statusLabel(displayStatus)}
        <ChevronDownIcon className={chevronClassName} />
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
});
