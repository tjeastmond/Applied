import type { JobApplication } from "@/types";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function searchableText(application: JobApplication): string {
  return [
    application.title,
    application.company,
    application.url,
    application.recruiterName,
    application.recruiterFirm,
    application.contactEmail,
    application.salaryRange,
    application.desiredSalary,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterApplicationsBySearch(applications: JobApplication[], searchQuery: string): JobApplication[] {
  const normalized = normalizeSearchQuery(searchQuery);
  if (!normalized) return applications;
  return applications.filter((application) => searchableText(application).includes(normalized));
}
