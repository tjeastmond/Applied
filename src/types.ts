import type { ApplicationStatus } from "@/lib/applicationStatus";

export type { ApplicationStatus };

/** Persisted salary fields on a job application (`salary_range`, `desired_salary`). */
export type ApplicationSalaryFields = {
  salaryRange: string | null;
  desiredSalary: string | null;
};

/** Salary fields in client form state (empty string when unset). */
export type ApplicationSalaryFormFields = {
  [K in keyof ApplicationSalaryFields]: string;
};

export interface JobApplication extends ApplicationSalaryFields {
  id: string;
  url: string;
  linkedinUrl: string | null;
  title: string | null;
  company: string | null;
  appliedAt: string;
  viaRecruiter: boolean;
  recruiterName: string | null;
  recruiterFirm: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  fullJd: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export type {
  ApplicationSalaryInput,
  CreateJobApplicationInput,
  ParsedApplicationSalaryFields,
  ParsedApplicationSalaryInput,
  ParsedCreateJobApplicationInput,
  PatchJobApplicationInput,
} from "@/lib/schemas/application";

export type { ParseJobUrlFailure, ParseJobUrlResult, ParseJobUrlSuccess } from "@/lib/schemas/parseJob";

export interface ApplicationNote {
  id: string;
  applicationId: string;
  content: string;
  createdAt: string;
}

export type ApplicationNoteMutationResult = ApplicationNote & {
  applicationUpdatedAt: string;
};

export type AgentApiTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
};

export type CreateAgentApiTokenResult = {
  token: string;
  record: AgentApiTokenSummary;
};
