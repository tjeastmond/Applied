import type { CreateJobApplicationInput, JobApplication } from "@/types";

export interface JobApplicationRepository {
  list(): Promise<JobApplication[]>;
  getById(id: string): Promise<JobApplication | null>;
  create(input: CreateJobApplicationInput): Promise<JobApplication>;
  update(id: string, input: Partial<CreateJobApplicationInput>): Promise<JobApplication | null>;
  delete(id: string): Promise<boolean>;
}
