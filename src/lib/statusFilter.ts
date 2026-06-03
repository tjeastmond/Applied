import type { ApplicationStatus, JobApplication } from "@/types";

export function filterApplicationsByStatuses(
  applications: JobApplication[],
  selectedStatuses: ReadonlySet<ApplicationStatus>,
): JobApplication[] {
  if (selectedStatuses.size === 0) return applications;
  return applications.filter((application) => selectedStatuses.has(application.status));
}

export function toggleStatusSelection(
  selected: Set<ApplicationStatus>,
  status: ApplicationStatus,
  checked: boolean,
): Set<ApplicationStatus> {
  const next = new Set(selected);
  if (checked) next.add(status);
  else next.delete(status);
  return next;
}
