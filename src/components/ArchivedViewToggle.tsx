"use client";

import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FILTER_CONTROL_HEIGHT_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import { ArchiveIcon } from "lucide-react";

export const ArchivedViewToggle = memo(function ArchivedViewToggle({
  includeArchived,
  onIncludeArchivedChange,
  disabled = false,
  className,
}: {
  includeArchived: boolean;
  onIncludeArchivedChange: (includeArchived: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        FILTER_CONTROL_HEIGHT_CLASS,
        "border-border bg-background hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50 shrink-0 rounded-lg border px-2.5 font-normal transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        includeArchived && !disabled && "border-primary/50 bg-primary/5 dark:bg-primary/10",
        className,
      )}
      title={disabled ? "Exit Archived-Only View To Include Archived In The Active List" : undefined}
    >
      <Checkbox
        checked={includeArchived}
        disabled={disabled}
        onCheckedChange={(checked) => onIncludeArchivedChange(checked === true)}
        aria-label="Include Archived Applications"
      />
      <ArchiveIcon className="size-3.5 shrink-0 opacity-70" />
      <span className="truncate">Include Archived</span>
    </Label>
  );
});
