import type { ApplicationStatus } from "@/lib/applicationStatus";
import type { JobApplication, ParsedCreateJobApplicationInput } from "@/types";

export type BulkArchiveResult = {
  archivedCount: number;
  applications: JobApplication[];
};

export interface JobApplicationRepository {
  list(): Promise<JobApplication[]>;
  listByIds(ids: string[]): Promise<JobApplication[]>;
  getById(id: string): Promise<JobApplication | null>;
  create(input: ParsedCreateJobApplicationInput): Promise<JobApplication>;
  update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null>;
  delete(id: string): Promise<boolean>;
  bulkArchiveByStatuses(statuses: readonly ApplicationStatus[]): Promise<BulkArchiveResult>;
}
