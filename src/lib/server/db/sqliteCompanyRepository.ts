import type Database from "better-sqlite3";
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

export class SqliteCompanyRepository implements CompanyRepository {
  private readonly listStmt;
  private readonly getByIdStmt;
  private readonly findByNormalizedNameStmt;
  private readonly insertStmt;
  private readonly updateStmt;
  private readonly setIgnoredStmt;

  constructor(db: Database.Database) {
    this.listStmt = db.prepare(LIST_COMPANIES_SQL);
    this.getByIdStmt = db.prepare(GET_COMPANY_BY_ID_SQL);
    this.findByNormalizedNameStmt = db.prepare(FIND_COMPANY_BY_NORMALIZED_NAME_SQL);
    this.insertStmt = db.prepare(INSERT_COMPANY_SQL);
    this.updateStmt = db.prepare(UPDATE_COMPANY_SQL);
    this.setIgnoredStmt = db.prepare(SET_COMPANY_IGNORED_SQL);
  }

  list(options?: CompanyListOptions): Promise<Company[]> {
    const rows = this.listStmt.all() as CompanyRow[];
    return Promise.resolve(rows.map(rowToCompany).filter((company) => companyMatchesListOptions(company, options)));
  }

  getById(id: string): Promise<Company | null> {
    const row = this.getByIdStmt.get(id) as CompanyRow | undefined;
    return Promise.resolve(row ? rowToCompany(row) : null);
  }

  findByNormalizedName(name: string): Promise<Company | null> {
    const row = this.findByNormalizedNameStmt.get(name) as CompanyRow | undefined;
    return Promise.resolve(row ? rowToCompany(row) : null);
  }

  async create(input: CreateCompanyInput): Promise<Company> {
    const existing = await this.findByNormalizedName(input.name);
    if (existing) {
      throw new Error("Company name already exists");
    }

    const company = buildCompany(input);
    this.insertStmt.run(companyToRow(company));
    return company;
  }

  async update(id: string, input: PatchCompanyInput): Promise<Company | null> {
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
    const result = this.updateStmt.run({
      id: updated.id,
      name: updated.name,
      url: updated.url,
      linkedin_url: updated.linkedinUrl,
      email: updated.email,
      updated_at: updated.updatedAt,
    });
    if (result.changes === 0) {
      return null;
    }

    return updated;
  }

  async setIgnored(id: string, ignored: boolean): Promise<Company | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ignored, updatedAt: new Date().toISOString() };
    const result = this.setIgnoredStmt.run({
      id: updated.id,
      ignored: ignored ? 1 : 0,
      updated_at: updated.updatedAt,
    });
    if (result.changes === 0) {
      return null;
    }

    return updated;
  }
}
