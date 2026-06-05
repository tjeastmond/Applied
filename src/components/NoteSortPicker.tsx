"use client";

import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { noteSortLabel, type NoteSortOrder } from "@/lib/noteSort";
import { cn } from "@/lib/utils";
import { ArrowDownUpIcon, ChevronDownIcon } from "lucide-react";

const NOTE_SORT_OPTIONS: NoteSortOrder[] = ["newest", "oldest"];

export function NoteSortPicker({
  sortOrder,
  onSortOrderChange,
  className,
}: {
  sortOrder: NoteSortOrder;
  onSortOrderChange: (order: NoteSortOrder) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleSortSelect(value: string) {
    if (!value || value === sortOrder) {
      setOpen(false);
      return;
    }

    onSortOrderChange(value as NoteSortOrder);
    setOpen(false);
  }

  const triggerClassName = cn(
    "text-muted-foreground hover:text-foreground inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 aria-expanded:ring-2",
    className,
  );

  if (!mounted) {
    return (
      <span className={triggerClassName} aria-hidden="true">
        <ArrowDownUpIcon className="size-3.5 shrink-0 opacity-70" />
        {noteSortLabel(sortOrder)}
        <ChevronDownIcon className="size-3 shrink-0 opacity-70" />
      </span>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger className={triggerClassName} aria-label="Sort notes">
        <ArrowDownUpIcon className="size-3.5 shrink-0 opacity-70" />
        {noteSortLabel(sortOrder)}
        <ChevronDownIcon className={cn("size-3 shrink-0 opacity-70 transition-transform duration-200", open && "rotate-180")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40 rounded-md">
        <DropdownMenuRadioGroup value={sortOrder} onValueChange={handleSortSelect}>
          {NOTE_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="rounded-sm"
              onClick={() => setOpen(false)}
            >
              {noteSortLabel(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
