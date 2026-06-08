import { toggleSetSelection } from "@/lib/toggleSetSelection";
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
  return toggleSetSelection(selected, status, checked);
}
