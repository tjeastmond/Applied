import { normalizeSearchQuery } from "@/lib/applicationSearch";
import type { AgentCompanySummary } from "@/lib/schemas/agent";
import { getCompanyRepository } from "@/lib/server/db";
import type { Company, CreateCompanyInput, ParsedPatchCompanyInput } from "@/types";

function toAgentCompanySummary(company: Company): AgentCompanySummary {
  return {
    id: company.id,
    name: company.name,
    url: company.url,
    linkedinUrl: company.linkedinUrl,
    email: company.email,
    ignored: company.ignored,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export async function listCompaniesForAgent(searchQuery = "", ignored?: boolean): Promise<AgentCompanySummary[]> {
  const companies = await getCompanyRepository().list({ ignored });
  const normalizedSearch = normalizeSearchQuery(searchQuery);

  const filtered = normalizedSearch
    ? companies.filter((company) => company.name.toLowerCase().includes(normalizedSearch))
    : companies;

  return filtered.map(toAgentCompanySummary);
}

export async function createCompanyForAgent(input: CreateCompanyInput): Promise<AgentCompanySummary> {
  const company = await getCompanyRepository().create(input);
  return toAgentCompanySummary(company);
}

export async function updateCompanyForAgent(
  id: string,
  input: ParsedPatchCompanyInput,
): Promise<AgentCompanySummary | null> {
  const company = await getCompanyRepository().update(id, input);
  return company ? toAgentCompanySummary(company) : null;
}

export async function setCompanyIgnoredForAgent(id: string, ignored: boolean): Promise<AgentCompanySummary | null> {
  const company = await getCompanyRepository().setIgnored(id, ignored);
  return company ? toAgentCompanySummary(company) : null;
}

export async function getCompanyForAgent(id: string): Promise<AgentCompanySummary | null> {
  const company = await getCompanyRepository().getById(id);
  return company ? toAgentCompanySummary(company) : null;
}
