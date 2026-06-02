export type ApplicationStatus = "applied" | "interviewing" | "rejected" | "offer";

export interface JobApplication {
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
  CreateJobApplicationInput,
  ParsedCreateJobApplicationInput,
  PatchJobApplicationInput,
} from "@/lib/schemas/application";

export type ParseJobUrlSuccess = {
  ok: true;
  title: string | null;
  company: string | null;
  fullJd: string | null;
};

export type ParseJobUrlFailure = {
  ok: false;
  error: string;
};

export type ParseJobUrlResult = ParseJobUrlSuccess | ParseJobUrlFailure;

export interface ApplicationNote {
  id: string;
  applicationId: string;
  content: string;
  createdAt: string;
}
