import type { JobApplication } from "@/types";

export function sortApplications(applications: JobApplication[]): JobApplication[] {
  return [...applications].sort((a, b) => {
    const byPinned = Number(b.pinned) - Number(a.pinned);
    if (byPinned !== 0) return byPinned;
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function upsertApplication(applications: JobApplication[], application: JobApplication): JobApplication[] {
  const existing = applications.find((item) => item.id === application.id);
  const without = applications.filter((item) => item.id !== application.id);
  // Keep a loaded fullJd when the incoming record is a list payload that omits it.
  return sortApplications([existing ? { ...existing, ...application } : application, ...without]);
}

export function removeApplication(applications: JobApplication[], id: string): JobApplication[] {
  return applications.filter((item) => item.id !== id);
}
