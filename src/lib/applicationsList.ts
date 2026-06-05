import type { JobApplication } from "@/types";

export function sortApplications(applications: JobApplication[]): JobApplication[] {
  return [...applications].sort((a, b) => {
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdated !== 0) return byUpdated;
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
