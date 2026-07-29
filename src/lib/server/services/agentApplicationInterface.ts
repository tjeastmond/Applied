import { filterAgentApplicationsBySearch, normalizeSearchQuery } from "@/lib/applicationSearch";
import type { ApplicationStatus } from "@/lib/applicationStatus";
import { normalizePastedJobUrl, today } from "@/lib/applicationForm";
import { formatZodError } from "@/lib/formatZodError";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import type { AgentApplicationSummary, AgentNoteSummary } from "@/lib/schemas/agent";
import { getNoteRepository, getRepository } from "@/lib/server/db";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import { patchApplicationWithSideEffects } from "@/lib/server/services/applicationMutationService";
import { touchApplicationUpdatedAt } from "@/lib/server/touchApplicationUpdatedAt";
import type { JobApplication } from "@/types";
import { parseJobUrl } from "./parseJobUrl";

type CreateApplicationFromUrlResult = { ok: true; application: AgentApplicationSummary } | { ok: false; error: string };

const AGENT_CREATE_AUDIT_NOTE = "Created by the CLI";
const AGENT_UPDATE_AUDIT_NOTE = "Updated by the CLI";

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

function toAgentNoteSummary(note: { id: string; content: string; createdAt: string }): AgentNoteSummary {
  return {
    id: note.id,
    content: note.content,
    createdAt: note.createdAt,
  };
}

async function getVisibleApplicationForAgent(id: string): Promise<JobApplication | null> {
  const application = await getRepository().getById(id);
  if (!application || application.archived) {
    return null;
  }
  return application;
}

export async function listApplicationsForAgent(searchQuery = ""): Promise<AgentApplicationSummary[]> {
  const applications = (await getRepository().list()).filter((application) => !application.archived);
  const summaries = applications.map(toAgentApplicationSummary);
  return filterAgentApplicationsBySearch(summaries, searchQuery);
}

export async function getApplicationForAgent(id: string): Promise<AgentApplicationSummary | null> {
  const application = await getVisibleApplicationForAgent(id);
  return application ? toAgentApplicationSummary(application) : null;
}

export async function listCompaniesForAgent(searchQuery = ""): Promise<string[]> {
  const applications = (await getRepository().list()).filter((application) => !application.archived);
  const normalizedSearch = normalizeSearchQuery(searchQuery);
  const companies = new Set<string>();

  for (const application of applications) {
    const company = application.company?.trim();
    if (!company) continue;
    if (normalizedSearch && !company.toLowerCase().includes(normalizedSearch)) continue;
    companies.add(company);
  }

  return [...companies].sort((a, b) => a.localeCompare(b));
}

export async function listNotesForAgent(applicationId: string): Promise<AgentNoteSummary[] | null> {
  const application = await getVisibleApplicationForAgent(applicationId);
  if (!application) {
    return null;
  }

  const notes = await getNoteRepository().listByApplicationId(applicationId);
  return notes.map(toAgentNoteSummary);
}

export async function createNoteForAgent(
  applicationId: string,
  content: string,
): Promise<(AgentNoteSummary & { applicationUpdatedAt: string }) | null> {
  const application = await getVisibleApplicationForAgent(applicationId);
  if (!application) {
    return null;
  }

  const note = await getNoteRepository().create(applicationId, content);
  const applicationUpdatedAt = (await touchApplicationUpdatedAt(applicationId)) ?? application.updatedAt;
  return {
    ...toAgentNoteSummary(note),
    applicationUpdatedAt,
  };
}

export async function updateApplicationStatusForAgent(
  id: string,
  status: ApplicationStatus,
): Promise<AgentApplicationSummary | null> {
  const existing = await getVisibleApplicationForAgent(id);
  if (!existing) {
    return null;
  }

  if (existing.status === status) {
    return toAgentApplicationSummary(existing);
  }

  const updated = await patchApplicationWithSideEffects(id, { status }, existing);
  if (!updated) {
    return null;
  }

  await getNoteRepository().create(id, AGENT_UPDATE_AUDIT_NOTE);
  const applicationUpdatedAt = await touchApplicationUpdatedAt(id);
  return toAgentApplicationSummary({
    ...updated,
    updatedAt: applicationUpdatedAt ?? updated.updatedAt,
  });
}

export async function createApplicationFromUrlForAgent(
  rawUrl: string,
  status: ApplicationStatus = "to_apply",
): Promise<CreateApplicationFromUrlResult> {
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
    salaryRange: parsedJob.salaryRange,
    fullJd: parsedJob.fullJd,
    status,
  });

  if (!input.success) {
    return { ok: false, error: formatZodError(input.error) };
  }

  const application = await getRepository().create(sanitizeApplicationInput(input.data));
  await getNoteRepository().create(application.id, AGENT_CREATE_AUDIT_NOTE);
  const applicationUpdatedAt = await touchApplicationUpdatedAt(application.id);
  return {
    ok: true,
    application: toAgentApplicationSummary({
      ...application,
      updatedAt: applicationUpdatedAt ?? application.updatedAt,
    }),
  };
}
