import { normalizePastedJobUrl, today } from "@/lib/applicationForm";
import { formatZodError } from "@/lib/formatZodError";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { getRepository } from "@/lib/server/db";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import type { JobApplication } from "@/types";
import { parseJobUrl } from "./parseJobUrl";

export type AgentApplicationSummary = Pick<
  JobApplication,
  "id" | "url" | "status" | "title" | "company" | "appliedAt" | "updatedAt"
>;

type CreateApplicationFromUrlResult = { ok: true; application: AgentApplicationSummary } | { ok: false; error: string };

function toAgentApplicationSummary(application: JobApplication): AgentApplicationSummary {
  return {
    id: application.id,
    url: application.url,
    status: application.status,
    title: application.title,
    company: application.company,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
  };
}

export async function listApplicationsForAgent(): Promise<AgentApplicationSummary[]> {
  const applications = await getRepository().list();
  return applications.map(toAgentApplicationSummary);
}

export async function createApplicationFromUrlForAgent(rawUrl: string): Promise<CreateApplicationFromUrlResult> {
  const url = normalizePastedJobUrl(rawUrl);
  if (!url) {
    return { ok: false, error: "URL must be a valid http or https URL" };
  }

  const parsedJob = await parseJobUrl(url);
  if (!parsedJob.ok) {
    return { ok: false, error: parsedJob.error };
  }

  if (!parsedJob.title || !parsedJob.company) {
    return { ok: false, error: "Parsed job URL must include a title and company" };
  }

  const input = createJobApplicationSchema.safeParse({
    url,
    title: parsedJob.title,
    company: parsedJob.company,
    appliedAt: today(),
    fullJd: parsedJob.fullJd,
    status: "to_apply",
  });

  if (!input.success) {
    return { ok: false, error: formatZodError(input.error) };
  }

  const application = await getRepository().create(sanitizeApplicationInput(input.data));
  return { ok: true, application: toAgentApplicationSummary(application) };
}
