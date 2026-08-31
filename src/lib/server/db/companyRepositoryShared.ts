import { normalizeCompanyName } from "@/lib/schemas/company";
import type { Company, CreateCompanyInput, PatchCompanyInput } from "@/types";
import { nowIso } from "./applicationRepositoryShared";

export type CompanyRow = {
  id: string;
  name: string;
  url: string | null;
  linkedin_url: string | null;
  email: string | null;
  ignored: number;
  created_at: string;
  updated_at: string;
};

export const LIST_COMPANIES_SQL = `SELECT id, name, url, linkedin_url, email, ignored, created_at, updated_at
FROM companies
ORDER BY lower(trim(name)) ASC, created_at ASC`;

export const GET_COMPANY_BY_ID_SQL = `SELECT id, name, url, linkedin_url, email, ignored, created_at, updated_at FROM companies WHERE id = ?`;

export const FIND_COMPANY_BY_NORMALIZED_NAME_SQL = `SELECT id, name, url, linkedin_url, email, ignored, created_at, updated_at
FROM companies WHERE lower(trim(name)) = lower(trim(?))`;

export const INSERT_COMPANY_SQL = `INSERT INTO companies (id, name, url, linkedin_url, email, ignored, created_at, updated_at)
VALUES (@id, @name, @url, @linkedin_url, @email, @ignored, @created_at, @updated_at)`;

export const UPDATE_COMPANY_SQL = `UPDATE companies SET
  name = @name,
  url = @url,
  linkedin_url = @linkedin_url,
  email = @email,
  updated_at = @updated_at
WHERE id = @id`;

export const SET_COMPANY_IGNORED_SQL = `UPDATE companies SET
  ignored = @ignored,
  updated_at = @updated_at
WHERE id = @id`;

export function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    linkedinUrl: row.linkedin_url,
    email: row.email,
    ignored: row.ignored === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contactField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function buildCompany(input: CreateCompanyInput): Company {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    name: input.name,
    url: contactField(input.url),
    linkedinUrl: contactField(input.linkedinUrl),
    email: contactField(input.email),
    ignored: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function companyToRow(company: Company): CompanyRow {
  return {
    id: company.id,
    name: company.name,
    url: company.url,
    linkedin_url: company.linkedinUrl,
    email: company.email,
    ignored: company.ignored ? 1 : 0,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  };
}

export function buildCompanyUpdateRow(existing: Company, input: PatchCompanyInput): Company {
  return {
    ...existing,
    name: input.name ?? existing.name,
    url: input.url !== undefined ? contactField(input.url) : existing.url,
    linkedinUrl: input.linkedinUrl !== undefined ? contactField(input.linkedinUrl) : existing.linkedinUrl,
    email: input.email !== undefined ? contactField(input.email) : existing.email,
    updatedAt: nowIso(),
  };
}

export function companyMatchesListOptions(company: Company, options?: { search?: string; ignored?: boolean }): boolean {
  if (options?.ignored !== undefined && company.ignored !== options.ignored) {
    return false;
  }

  const search = options?.search?.trim();
  if (!search) {
    return true;
  }

  return company.name.toLowerCase().includes(search.toLowerCase());
}

export function normalizedNamesEqual(left: string, right: string): boolean {
  return normalizeCompanyName(left) === normalizeCompanyName(right);
}
