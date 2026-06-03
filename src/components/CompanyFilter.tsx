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
import { toggleCompanySelection } from "@/lib/companyFilter";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";

const FILTER_WIDTH_CLASS = "w-56";

export const CompanyFilter = memo(function CompanyFilter({
  companies,
  selectedCompanies,
  onSelectedCompaniesChange,
  className,
}: {
  companies: string[];
  selectedCompanies: Set<string>;
  onSelectedCompaniesChange: (next: Set<string>) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = selectedCompanies.size;
  const label =
    activeCount === 0
      ? "All companies"
      : activeCount === 1
        ? [...selectedCompanies][0]
        : `${activeCount} companies`;

  function clearFilters() {
    onSelectedCompaniesChange(new Set());
  }

  return (
    <div className={cn("flex h-8 items-center gap-2", className)}>
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 justify-between gap-2 px-2.5 font-normal active:translate-y-0",
              FILTER_WIDTH_CLASS,
            )}
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
      <DropdownMenuContent align="start" className={cn(FILTER_WIDTH_CLASS, "min-w-56 w-56")}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Company</DropdownMenuLabel>
          {companies.map((company) => (
            <DropdownMenuCheckboxItem
              key={company}
              checked={selectedCompanies.has(company)}
              onCheckedChange={(checked) =>
                onSelectedCompaniesChange(toggleCompanySelection(selectedCompanies, company, checked === true))
              }
            >
              {company}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    {activeCount > 0 ? (
      <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2.5" onClick={clearFilters}>
        Clear filters
      </Button>
    ) : null}
    </div>
  );
});
