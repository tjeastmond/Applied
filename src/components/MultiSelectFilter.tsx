"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FILTER_TRIGGER_BUTTON_CLASS } from "@/lib/filterControls";
import { toggleSetSelection } from "@/lib/toggleSetSelection";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";

type MultiSelectFilterItem<T extends string> = {
  value: T;
  label: ReactNode;
};

export function MultiSelectFilter<T extends string>({
  items,
  selected,
  onSelectedChange,
  emptyLabel,
  pluralNoun,
  groupLabel,
  formatSingleLabel,
  disabled = false,
  className,
}: {
  items: MultiSelectFilterItem<T>[];
  selected: Set<T>;
  onSelectedChange: (next: Set<T>) => void;
  emptyLabel: string;
  pluralNoun: string;
  groupLabel: string;
  formatSingleLabel?: (value: T) => string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = selected.size;
  const singleValue = activeCount === 1 ? selected.values().next().value : undefined;
  const label =
    activeCount === 0
      ? emptyLabel
      : activeCount === 1 && singleValue !== undefined
        ? (formatSingleLabel?.(singleValue) ?? singleValue)
        : `${activeCount} ${pluralNoun}`;

  function handleOpenChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={disabled}
            className={cn(FILTER_TRIGGER_BUTTON_CLASS, className)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <ListFilterIcon className="size-3.5 shrink-0 opacity-70" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDownIcon
              className={cn("size-3.5 shrink-0 opacity-70 transition-transform duration-200", open && "rotate-180")}
            />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
          {items.map((item) => (
            <DropdownMenuCheckboxItem
              key={item.value}
              checked={selected.has(item.value)}
              onCheckedChange={(checked) =>
                onSelectedChange(toggleSetSelection(selected, item.value, checked === true))
              }
            >
              {item.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
