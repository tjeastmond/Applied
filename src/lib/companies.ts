import { normalizeCompanyName } from "@/lib/schemas/company";
import type { Company, JobApplication } from "@/types";

export const COMPANIES_PATH = "/companies";
export const COMPANIES_IGNORED_PATH = "/companies/ignored";

export type CompanyViewMode = "active" | "ignored";

/** True for the list routes and any `/companies/<id>` detail route. */
export function isCompaniesRoute(pathname: string): boolean {
  return pathname === COMPANIES_PATH || pathname.startsWith(`${COMPANIES_PATH}/`);
}

export function companyPath(id: string): string {
  return `${COMPANIES_PATH}/${encodeURIComponent(id)}`;
}

/** Company id for `/companies/<id>`; null for the list routes and non-company paths. */
export function companyIdFromPath(pathname: string): string | null {
  if (!pathname.startsWith(`${COMPANIES_PATH}/`)) return null;
  const rest = pathname.slice(COMPANIES_PATH.length + 1).replace(/\/+$/, "");
  if (!rest || rest.includes("/") || pathname === COMPANIES_IGNORED_PATH) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

export function findCompanyByName(companies: Company[], name: string): Company | null {
  const target = normalizeCompanyName(name);
  if (!target) return null;
  return companies.find((company) => normalizeCompanyName(company.name) === target) ?? null;
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
    if (viewMode === "ignored" && !company.ignored) {
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

export type CompanyContact = {
  name: string | null;
  firm: string | null;
  email: string | null;
  phone: string | null;
  sourceTitles: string[];
};

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Read-only contacts derived from application recruiter/contact fields, deduped by email then name. */
export function deriveCompanyContacts(applications: JobApplication[]): CompanyContact[] {
  const contacts: CompanyContact[] = [];
  const byKey = new Map<string, CompanyContact>();

  for (const application of applications) {
    const name = trimmedOrNull(application.recruiterName);
    const firm = trimmedOrNull(application.recruiterFirm);
    const email = trimmedOrNull(application.contactEmail);
    const phone = trimmedOrNull(application.contactPhone);
    if (!name && !firm && !email && !phone) continue;

    const key = email ? `email:${email.toLowerCase()}` : name ? `name:${name.toLowerCase()}` : null;
    const title = trimmedOrNull(application.title) ?? application.url;
    const existing = key ? byKey.get(key) : undefined;

    if (existing) {
      existing.name ??= name;
      existing.firm ??= firm;
      existing.email ??= email;
      existing.phone ??= phone;
      if (!existing.sourceTitles.includes(title)) existing.sourceTitles.push(title);
      continue;
    }

    const contact: CompanyContact = { name, firm, email, phone, sourceTitles: [title] };
    contacts.push(contact);
    if (key) byKey.set(key, contact);
  }

  return contacts;
}
