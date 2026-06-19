import type Database from "better-sqlite3";
import type { ApplicationStatus } from "@/lib/applicationStatus";
import type { JobApplication, ParsedCreateJobApplicationInput } from "@/types";
import type { BulkArchiveResult, JobApplicationRepository } from "../repositories/jobApplicationRepository";
import {
  buildApplicationInsertRow,
  buildApplicationUpdateRow,
  buildBulkArchiveByStatusesSql,
  DELETE_APPLICATION_SQL,
  GET_APPLICATION_BY_ID_SQL,
  INSERT_APPLICATION_SQL,
  LIST_APPLICATIONS_SQL,
  nowIso,
  rowToApplication,
  type ApplicationRow,
  UPDATE_APPLICATION_SQL,
} from "./applicationRepositoryShared";

export class SqliteJobApplicationRepository implements JobApplicationRepository {
  private readonly db;
  private readonly listStmt;
  private readonly getByIdStmt;
  private readonly insertStmt;
  private readonly updateStmt;
  private readonly deleteStmt;

  constructor(db: Database.Database) {
    this.db = db;
    this.listStmt = db.prepare(LIST_APPLICATIONS_SQL);
    this.getByIdStmt = db.prepare(GET_APPLICATION_BY_ID_SQL);
    this.insertStmt = db.prepare(INSERT_APPLICATION_SQL);
    this.updateStmt = db.prepare(UPDATE_APPLICATION_SQL);
    this.deleteStmt = db.prepare(DELETE_APPLICATION_SQL);
  }

  async list(): Promise<JobApplication[]> {
    const rows = this.listStmt.all() as ApplicationRow[];
    return rows.map(rowToApplication);
  }

  async listByIds(ids: string[]): Promise<JobApplication[]> {
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(ids)];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const sql = `${LIST_APPLICATIONS_SQL.replace("FROM applications", `FROM applications WHERE id IN (${placeholders})`)}`;
    const rows = this.db.prepare(sql).all(...uniqueIds) as ApplicationRow[];
    const applicationsById = new Map(rows.map((row) => [row.id, rowToApplication(row)]));
    return uniqueIds.flatMap((id) => {
      const application = applicationsById.get(id);
      return application ? [application] : [];
    });
  }

  async getById(id: string): Promise<JobApplication | null> {
    const row = this.getByIdStmt.get(id) as ApplicationRow | undefined;
    return row ? rowToApplication(row) : null;
  }

  async create(input: ParsedCreateJobApplicationInput): Promise<JobApplication> {
    const created = buildApplicationInsertRow(input);

    this.insertStmt.run(created);

    const row = this.getByIdStmt.get(created.id) as ApplicationRow | undefined;

    if (!row) {
      throw new Error("Failed to create application");
    }

    return rowToApplication(row);
  }

  async update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null> {
    const existing = this.getByIdStmt.get(id) as ApplicationRow | undefined;

    if (!existing) {
      return null;
    }

    const updated = buildApplicationUpdateRow(existing, input);

    this.updateStmt.run({
      id,
      url: updated.url,
      linkedin_url: updated.linkedin_url,
      title: updated.title,
      company: updated.company,
      applied_at: updated.applied_at,
      via_recruiter: updated.via_recruiter,
      recruiter_name: updated.recruiter_name,
      recruiter_firm: updated.recruiter_firm,
      contact_email: updated.contact_email,
      contact_phone: updated.contact_phone,
      salary_range: updated.salary_range,
      desired_salary: updated.desired_salary,
      full_jd: updated.full_jd,
      status: updated.status,
      archived: updated.archived,
      updated_at: updated.updated_at,
    });

    return rowToApplication(updated);
  }

  async bulkArchiveByStatuses(statuses: readonly ApplicationStatus[]): Promise<BulkArchiveResult> {
    if (statuses.length === 0) {
      return { archivedCount: 0, applications: await this.list() };
    }

    const timestamp = nowIso();
    const sql = buildBulkArchiveByStatusesSql(statuses);
    const result = this.db.prepare(sql).run(timestamp, ...statuses);

    return {
      archivedCount: result.changes,
      applications: await this.list(),
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }
}
