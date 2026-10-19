import type { ApplicationStatus } from "@/lib/applicationStatus";
import type { JobApplication } from "@/types";

export const STALE_APPLICATION_MONTHS = 2;

/** Statuses that can go stale; offers, passed, rejected, and to-apply items are left alone. */
export const STALE_ELIGIBLE_STATUSES = [
  "applied",
  "waiting",
  "interviewing",
  "no_response",
] as const satisfies readonly ApplicationStatus[];

export function staleApplicationCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - STALE_APPLICATION_MONTHS);
  return cutoff;
}

export function isStaleApplication(
  application: Pick<JobApplication, "status" | "archived" | "updatedAt">,
  now: Date = new Date(),
): boolean {
  if (application.archived) return false;
  if (!(STALE_ELIGIBLE_STATUSES as readonly ApplicationStatus[]).includes(application.status)) return false;
  const updatedAt = Date.parse(application.updatedAt);
  return Number.isFinite(updatedAt) && updatedAt < staleApplicationCutoff(now).getTime();
}

export function countStaleApplications(applications: readonly JobApplication[], now: Date = new Date()): number {
  return applications.filter((application) => isStaleApplication(application, now)).length;
}

export function archiveStaleConfirmDescription(count: number): string {
  const noun = count === 1 ? "application" : "applications";
  return `Mark ${count} ${noun} with no update in the last ${STALE_APPLICATION_MONTHS} months as No Response and archive ${count === 1 ? "it" : "them"}? Offers, passed, rejected, and to-apply items are not affected.`;
}
