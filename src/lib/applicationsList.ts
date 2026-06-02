import type { JobApplication } from "@/types";

export function sortApplications(applications: JobApplication[]): JobApplication[] {
  return [...applications].sort((a, b) => {
    const byApplied = b.appliedAt.localeCompare(a.appliedAt);
    if (byApplied !== 0) return byApplied;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function upsertApplication(applications: JobApplication[], application: JobApplication): JobApplication[] {
  const without = applications.filter((item) => item.id !== application.id);
  return sortApplications([application, ...without]);
}

export function removeApplication(applications: JobApplication[], id: string): JobApplication[] {
  return applications.filter((item) => item.id !== id);
}
