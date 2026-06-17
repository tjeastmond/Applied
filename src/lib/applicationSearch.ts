import { statusLabel } from "@/lib/applicationStatus";
import type { AgentApplicationSummary } from "@/lib/schemas/agent";
import type { JobApplication } from "@/types";

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function buildSearchableText(values: Array<string | null | undefined>): string {
  return values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterBySearch<T>(items: T[], searchQuery: string, toSearchableText: (item: T) => string): T[] {
  const normalized = normalizeSearchQuery(searchQuery);
  if (!normalized) return items;
  return items.filter((item) => toSearchableText(item).includes(normalized));
}

function searchableText(application: JobApplication): string {
  return buildSearchableText([
    application.title,
    application.company,
    application.url,
    application.recruiterName,
    application.recruiterFirm,
    application.contactEmail,
    application.salaryRange,
    application.desiredSalary,
  ]);
}

function agentSearchableText(application: AgentApplicationSummary): string {
  return buildSearchableText([
    application.title,
    application.company,
    application.url,
    application.status,
    statusLabel(application.status),
    application.appliedAt,
  ]);
}

export function filterApplicationsBySearch(applications: JobApplication[], searchQuery: string): JobApplication[] {
  return filterBySearch(applications, searchQuery, searchableText);
}

export function filterAgentApplicationsBySearch(
  applications: AgentApplicationSummary[],
  searchQuery: string,
): AgentApplicationSummary[] {
  return filterBySearch(applications, searchQuery, agentSearchableText);
}
