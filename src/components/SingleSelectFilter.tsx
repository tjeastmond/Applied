"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterDropdownTrigger } from "@/components/FilterDropdownTrigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SingleSelectFilterItem<T extends string> = {
  value: T;
  label: ReactNode;
};

export function SingleSelectFilter<T extends string>({
  items,
  value,
  onValueChange,
  groupLabel,
  leadingIcon,
  ariaLabel,
  className,
}: {
  items: readonly SingleSelectFilterItem<T>[];
  value: T;
  onValueChange: (next: T) => void;
  groupLabel: string;
  leadingIcon?: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const blurFrameRef = useRef<number | null>(null);
  const selectedItem = items.find((item) => item.value === value);

  useEffect(
    () => () => {
      if (blurFrameRef.current !== null) window.cancelAnimationFrame(blurFrameRef.current);
    },
    [],
  );

  function handleValueChange(nextValue: string) {
    if (nextValue !== value) onValueChange(nextValue as T);
    setOpen(false);
    if (blurFrameRef.current !== null) window.cancelAnimationFrame(blurFrameRef.current);
    blurFrameRef.current = window.requestAnimationFrame(() => {
      triggerRef.current?.blur();
      blurFrameRef.current = null;
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        render={
          <FilterDropdownTrigger
            label={selectedItem?.label ?? value}
            leadingIcon={leadingIcon}
            open={open}
            className={className}
            ref={triggerRef}
            aria-label={ariaLabel}
          />
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={handleValueChange}>
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
