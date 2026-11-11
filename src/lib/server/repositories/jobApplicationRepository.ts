import type { ApplicationStatus } from "@/lib/applicationStatus";
import type { JobApplication, ParsedCreateJobApplicationInput } from "@/types";

export type BulkArchiveResult = {
  archivedCount: number;
  applications: JobApplication[];
};

export interface JobApplicationRepository {
  /** Full records including fullJd (backup, export, transfer, sync). */
  list(): Promise<JobApplication[]>;
  /** Same order as list() but fullJd is always null; use for list/bulk/SSR/agent paths. */
  listSummaries(): Promise<JobApplication[]>;
  /** Summaries (fullJd null) for the given ids, in request order. */
  listByIds(ids: string[]): Promise<JobApplication[]>;
  getById(id: string): Promise<JobApplication | null>;
  create(input: ParsedCreateJobApplicationInput): Promise<JobApplication>;
  update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null>;
  touch(id: string): Promise<string | null>;
  delete(id: string): Promise<boolean>;
  bulkArchiveByStatuses(statuses: readonly ApplicationStatus[]): Promise<BulkArchiveResult>;
}
