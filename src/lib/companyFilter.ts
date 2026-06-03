import type { JobApplication } from "@/types";

export function uniqueCompanyNames(applications: JobApplication[]): string[] {
  const names = new Set<string>();
  for (const application of applications) {
    const company = application.company?.trim();
    if (company) names.add(company);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function filterApplicationsByCompanies(
  applications: JobApplication[],
  selectedCompanies: ReadonlySet<string>,
): JobApplication[] {
  if (selectedCompanies.size === 0) return applications;
  return applications.filter((application) => {
    const company = application.company?.trim() ?? "";
    return company.length > 0 && selectedCompanies.has(company);
  });
}

export function toggleCompanySelection(
  selected: Set<string>,
  company: string,
  checked: boolean,
): Set<string> {
  const next = new Set(selected);
  if (checked) next.add(company);
  else next.delete(company);
  return next;
}
