import type { ApplicationStatus } from "@/lib/applicationStatus";
import { ARCHIVABLE_STATUSES, isArchivableStatus } from "@/lib/archivableStatuses";
import type { JobApplication } from "@/types";

export const ARCHIVED_VIEW_DEFAULT_STATUSES = new Set<ApplicationStatus>(ARCHIVABLE_STATUSES);

export const APPLICATION_VIEW_MODE_STORAGE_KEY = "applied-dev-view-mode";

export type ApplicationViewMode = "active" | "archived";

export function readStoredApplicationViewMode(): ApplicationViewMode {
  if (typeof window === "undefined") {
    return "active";
  }

  const stored = window.localStorage.getItem(APPLICATION_VIEW_MODE_STORAGE_KEY);
  return stored === "archived" ? "archived" : "active";
}

export function persistApplicationViewMode(viewMode: ApplicationViewMode): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(APPLICATION_VIEW_MODE_STORAGE_KEY, viewMode);
}

export function nextViewMode(current: ApplicationViewMode): ApplicationViewMode {
  return current === "active" ? "archived" : "active";
}

export function statusFiltersForViewMode(viewMode: ApplicationViewMode): Set<ApplicationStatus> {
  return viewMode === "archived" ? new Set(ARCHIVED_VIEW_DEFAULT_STATUSES) : new Set();
}

export function archiveViewToggleLabel(viewMode: ApplicationViewMode): string {
  return viewMode === "active" ? "View archived applications" : "Back to active applications";
}

export function partitionApplicationsByView(
  applications: JobApplication[],
  viewMode: ApplicationViewMode,
): JobApplication[] {
  return applications.filter((application) => applicationMatchesViewMode(application, viewMode));
}

export function applicationMatchesViewMode(application: JobApplication, viewMode: ApplicationViewMode): boolean {
  return viewMode === "archived" ? application.archived : !application.archived;
}

export function countArchivableApplications(applications: JobApplication[]): number {
  return applications.filter((application) => !application.archived && isArchivableStatus(application.status)).length;
}

export function bulkArchiveConfirmTitle(): string {
  return "Archive rejected and passed applications?";
}

export function bulkArchiveConfirmDescription(count: number): string {
  return count === 1
    ? "Archive 1 rejected or passed application? It will move to the archived view."
    : `Archive ${count} rejected and passed applications? They will move to the archived view.`;
}
