import type { ApplicationStatus } from "@/lib/applicationStatus";
import { getStatusHistoryRepository } from "@/lib/server/db";
import { resolveCurrentUserId } from "@/lib/server/currentUser";
import type { ApplicationStatusHistoryEntry } from "@/types";

export async function recordApplicationStatusChange(input: {
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt?: string;
  userId?: string;
}): Promise<ApplicationStatusHistoryEntry> {
  const userId = input.userId ?? (await resolveCurrentUserId());
  return getStatusHistoryRepository().record({
    applicationId: input.applicationId,
    userId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedAt: input.changedAt,
  });
}

export async function recordInitialApplicationStatus(input: {
  applicationId: string;
  status: ApplicationStatus;
  changedAt: string;
  userId?: string;
}): Promise<ApplicationStatusHistoryEntry> {
  return recordApplicationStatusChange({
    applicationId: input.applicationId,
    fromStatus: null,
    toStatus: input.status,
    changedAt: input.changedAt,
    userId: input.userId,
  });
}
