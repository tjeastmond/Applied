import type { ApplicationStatus } from "@/lib/applicationStatus";

export const ARCHIVABLE_STATUSES = ["rejected", "passed"] as const;

export type ArchivableStatus = (typeof ARCHIVABLE_STATUSES)[number];

export function isArchivableStatus(status: ApplicationStatus): status is ArchivableStatus {
  return (ARCHIVABLE_STATUSES as readonly ApplicationStatus[]).includes(status);
}

export function isArchivableStatusList(
  statuses: readonly ApplicationStatus[],
): statuses is readonly ArchivableStatus[] {
  return statuses.length > 0 && statuses.every(isArchivableStatus);
}
