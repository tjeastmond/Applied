import type { Client } from "@tursodatabase/serverless/compat";
import type { Company, CreateCompanyInput, PatchCompanyInput } from "@/types";
import type { CompanyListOptions, CompanyRepository } from "../repositories/companyRepository";
import {
  buildCompany,
  buildCompanyUpdateRow,
  companyMatchesListOptions,
  companyToRow,
  FIND_COMPANY_BY_NORMALIZED_NAME_SQL,
  GET_COMPANY_BY_ID_SQL,
  INSERT_COMPANY_SQL,
  LIST_COMPANIES_SQL,
  normalizedNamesEqual,
  rowToCompany,
  SET_COMPANY_IGNORED_SQL,
  UPDATE_COMPANY_SQL,
  type CompanyRow,
} from "./companyRepositoryShared";
import { tursoFirstRow, tursoRows } from "./tursoRowHelpers";

function nullableRowString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return null;
}

function rowToCompanyRow(row: Record<string, unknown>): CompanyRow {
  return {
    id: String(row.id),
    name: String(row.name),
    url: nullableRowString(row.url),
    linkedin_url: nullableRowString(row.linkedin_url),
    email: nullableRowString(row.email),
    ignored: Number(row.ignored),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export class TursoCompanyRepository implements CompanyRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async list(options?: CompanyListOptions): Promise<Company[]> {
    await this.ready;
    const rows = (await tursoRows(this.client, LIST_COMPANIES_SQL)).map(rowToCompanyRow);
    return rows.map(rowToCompany).filter((company) => companyMatchesListOptions(company, options));
  }

  async getById(id: string): Promise<Company | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, GET_COMPANY_BY_ID_SQL, [id]);
    return row ? rowToCompany(rowToCompanyRow(row)) : null;
  }

  async findByNormalizedName(name: string): Promise<Company | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, FIND_COMPANY_BY_NORMALIZED_NAME_SQL, [name]);
    return row ? rowToCompany(rowToCompanyRow(row)) : null;
  }

  async create(input: CreateCompanyInput): Promise<Company> {
    await this.ready;
    const existing = await this.findByNormalizedName(input.name);
    if (existing) {
      throw new Error("Company name already exists");
    }

    const company = buildCompany(input);
    await this.client.execute({ sql: INSERT_COMPANY_SQL, args: companyToRow(company) });
    return company;
  }

  async update(id: string, input: PatchCompanyInput): Promise<Company | null> {
    await this.ready;
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    if (input.name && !normalizedNamesEqual(input.name, existing.name)) {
      const duplicate = await this.findByNormalizedName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw new Error("Company name already exists");
      }
    }

    const updated = buildCompanyUpdateRow(existing, input);
    const result = await this.client.execute({
      sql: UPDATE_COMPANY_SQL,
      args: {
        id: updated.id,
        name: updated.name,
        url: updated.url,
        linkedin_url: updated.linkedinUrl,
        email: updated.email,
        updated_at: updated.updatedAt,
      },
    });
    if (result.rowsAffected === 0) {
      return null;
    }

    return updated;
  }

  async setIgnored(id: string, ignored: boolean): Promise<Company | null> {
    await this.ready;
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ignored, updatedAt: new Date().toISOString() };
    const result = await this.client.execute({
      sql: SET_COMPANY_IGNORED_SQL,
      args: {
        id: updated.id,
        ignored: ignored ? 1 : 0,
        updated_at: updated.updatedAt,
      },
    });
    if (result.rowsAffected === 0) {
      return null;
    }

    return updated;
  }
}
