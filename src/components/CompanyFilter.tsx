"use client";

import { memo, useMemo } from "react";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";

export const CompanyFilter = memo(function CompanyFilter({
  companies,
  selectedCompanies,
  onSelectedCompaniesChange,
  className,
  disabled = false,
}: {
  companies: string[];
  selectedCompanies: Set<string>;
  onSelectedCompaniesChange: (next: Set<string>) => void;
  className?: string;
  disabled?: boolean;
}) {
  const items = useMemo(() => companies.map((company) => ({ value: company, label: company })), [companies]);

  return (
    <MultiSelectFilter
      items={items}
      selected={selectedCompanies}
      onSelectedChange={onSelectedCompaniesChange}
      emptyLabel="Filter By Company"
      pluralNoun="companies"
      groupLabel="Company"
      disabled={disabled}
      className={className}
    />
  );
});
