import type { JobApplication, ParsedCreateJobApplicationInput } from "@/types";

export interface JobApplicationRepository {
  list(): Promise<JobApplication[]>;
  getById(id: string): Promise<JobApplication | null>;
  create(input: ParsedCreateJobApplicationInput): Promise<JobApplication>;
  update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null>;
  delete(id: string): Promise<boolean>;
}
