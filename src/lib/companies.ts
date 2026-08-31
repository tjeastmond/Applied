import type { Company, JobApplication } from "@/types";

export const COMPANIES_PATH = "/companies";
export const COMPANIES_IGNORED_PATH = "/companies/ignored";

export type CompanyViewMode = "active" | "ignored";

export function isCompaniesRoute(pathname: string): boolean {
  return pathname === COMPANIES_PATH || pathname === COMPANIES_IGNORED_PATH;
}

export function isCompaniesIgnoredRoute(pathname: string): boolean {
  return pathname === COMPANIES_IGNORED_PATH;
}

export function companyViewModeFromPath(pathname: string): CompanyViewMode {
  return isCompaniesIgnoredRoute(pathname) ? "ignored" : "active";
}

export function sortCompanies(companies: Company[]): Company[] {
  return [...companies].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

export function filterCompanies(companies: Company[], searchQuery: string, viewMode: CompanyViewMode): Company[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return companies.filter((company) => {
    if (viewMode === "ignored" ? !company.ignored : company.ignored) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return company.name.toLowerCase().includes(normalizedSearch);
  });
}

function companyNameMatches(applicationCompany: string | null | undefined, companyName: string): boolean {
  return applicationCompany?.trim().toLowerCase() === companyName.trim().toLowerCase();
}

export function countApplicationsForCompany(applications: JobApplication[], companyName: string): number {
  return applications.filter((application) => companyNameMatches(application.company, companyName)).length;
}

export function listApplicationsForCompany(applications: JobApplication[], companyName: string): JobApplication[] {
  return applications
    .filter((application) => companyNameMatches(application.company, companyName))
    .sort((left, right) => right.appliedAt.localeCompare(left.appliedAt));
}

export function computeCompanyNavCounts(companies: Company[]): { active: number; ignored: number } {
  let active = 0;
  let ignored = 0;

  for (const company of companies) {
    if (company.ignored) {
      ignored += 1;
    } else {
      active += 1;
    }
  }

  return { active, ignored };
}
