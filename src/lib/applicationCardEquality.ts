import type { JobApplication } from "@/types";

/** Fields shown on the list card — skip re-render when none of these change. */
export function applicationCardPropsEqual(
  prev: { application: JobApplication },
  next: { application: JobApplication },
): boolean {
  const a = prev.application;
  const b = next.application;
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.title === b.title &&
    a.company === b.company &&
    a.appliedAt === b.appliedAt &&
    a.linkedinUrl === b.linkedinUrl &&
    a.url === b.url &&
    a.updatedAt === b.updatedAt
  );
}
