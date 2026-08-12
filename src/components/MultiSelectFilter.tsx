"use client";

import { useState, type ReactNode } from "react";
import { FilterDropdownTrigger } from "@/components/FilterDropdownTrigger";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleSetSelection } from "@/lib/toggleSetSelection";

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
  contentClassName,
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
  contentClassName?: string;
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
        render={<FilterDropdownTrigger label={label} open={open} disabled={disabled} className={className} />}
      />
      <DropdownMenuContent align="start" className={contentClassName}>
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
