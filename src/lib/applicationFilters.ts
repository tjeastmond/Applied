import { filterApplicationsByCompanies } from "@/lib/companyFilter";
import { filterApplicationsBySearch } from "@/lib/applicationSearch";
import { filterApplicationsByStatuses } from "@/lib/statusFilter";
import type { ApplicationStatus, JobApplication } from "@/types";

export type ApplicationFiltersState = {
  selectedCompanies: ReadonlySet<string>;
  selectedStatuses: ReadonlySet<ApplicationStatus>;
  searchQuery: string;
};

export function hasActiveApplicationFilters({
  selectedCompanies,
  selectedStatuses,
  searchQuery,
}: ApplicationFiltersState): boolean {
  return (
    selectedCompanies.size > 0 ||
    selectedStatuses.size > 0 ||
    searchQuery.trim().length > 0
  );
}

export function filterApplications(
  applications: JobApplication[],
  filters: ApplicationFiltersState,
): JobApplication[] {
  let result = applications;
  result = filterApplicationsByCompanies(result, filters.selectedCompanies);
  result = filterApplicationsByStatuses(result, filters.selectedStatuses);
  result = filterApplicationsBySearch(result, filters.searchQuery);
  return result;
}
