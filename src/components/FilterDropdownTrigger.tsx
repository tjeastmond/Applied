import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FILTER_TRIGGER_BUTTON_CLASS } from "@/lib/filterControls";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";

export function FilterDropdownTrigger({
  label,
  leadingIcon,
  open,
  disabled = false,
  className,
  ref,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: ReactNode;
  leadingIcon?: ReactNode;
  open: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      disabled={disabled}
      className={cn(FILTER_TRIGGER_BUTTON_CLASS, className)}
      ref={ref}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {leadingIcon ?? <ListFilterIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      <ChevronDownIcon
        className={cn("size-3.5 shrink-0 opacity-70 transition-transform duration-200", open && "rotate-180")}
        aria-hidden
      />
    </Button>
  );
}
