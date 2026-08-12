import type { ApplicationStatus } from "@/lib/applicationStatus";

export type AnalyticsRepositoryFilters = {
  from: string | null;
  to: string | null;
  companies: readonly string[];
  statuses: readonly ApplicationStatus[];
  includeArchived: boolean;
};

export type AnalyticsApplicationRecord = {
  id: string;
  company: string | null;
  appliedAt: string;
  status: ApplicationStatus;
  createdAt: string;
  historyCount: number;
  everInterviewing: boolean;
  everOffer: boolean;
  initialFromStatus: ApplicationStatus | null;
  initialToStatus: ApplicationStatus | null;
  initialChangedAt: string | null;
};

export type AnalyticsRepositorySnapshot = {
  allTimeApplicationCount: number;
  applications: AnalyticsApplicationRecord[];
};

export interface AnalyticsRepository {
  loadSnapshot(filters: AnalyticsRepositoryFilters): Promise<AnalyticsRepositorySnapshot>;
}
