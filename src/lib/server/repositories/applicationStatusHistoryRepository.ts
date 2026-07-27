import type { ApplicationStatusHistoryEntry } from "@/types";
import type { ApplicationStatus } from "@/lib/applicationStatus";

export type RecordStatusHistoryInput = {
  applicationId: string;
  userId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt?: string;
};

export interface ApplicationStatusHistoryRepository {
  listByApplicationId(applicationId: string): Promise<ApplicationStatusHistoryEntry[]>;
  record(input: RecordStatusHistoryInput): Promise<ApplicationStatusHistoryEntry>;
  hasAnyForApplication(applicationId: string): Promise<boolean>;
}
