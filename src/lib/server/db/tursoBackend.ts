import { createClient, type Client, type InStatement, type InValue, type Row } from "@tursodatabase/serverless/compat";
import { applicationStatusSchema } from "@/lib/schemas/common";
import type { BackupJson, ImportMode } from "@/lib/schemas/backup";
import type { ApplicationNote, JobApplication, ParsedCreateJobApplicationInput } from "@/types";
import type { ApplicationStatus } from "@/lib/applicationStatus";
import type { DatabaseBackend } from "../databaseBackend";
import type { TursoDatabaseConfig } from "../databaseConfig";
import type { ApplicationNoteRepository } from "../repositories/applicationNoteRepository";
import type { BulkArchiveResult, JobApplicationRepository } from "../repositories/jobApplicationRepository";
import { createSqlBackupZip } from "../services/databaseBackupService";
import {
  applicationToRow,
  countSqlInserts,
  createBackupJson,
  exportSqlFromRecords,
  noteToRow,
  parseBackupJson,
  prepareSqlUpsertStatements,
  UPSERT_APPLICATION_SQL,
  UPSERT_NOTE_SQL,
} from "../services/backupService";
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
import {
  buildNote,
  DELETE_NOTE_FOR_APPLICATION_SQL,
  DELETE_NOTE_SQL,
  GET_NOTE_FOR_APPLICATION_SQL,
  INSERT_NOTE_SQL,
  LIST_ALL_NOTES_SQL,
  LIST_NOTES_BY_APPLICATION_SQL,
  rowToNote,
  type NoteRow,
  trimRequiredNoteContent,
  UPDATE_NOTE_FOR_APPLICATION_SQL,
} from "./applicationNoteRepositoryShared";
import { APPLICATION_LEGACY_COLUMNS, readSchemaSql } from "./schema";
import { TursoAgentApiTokenRepository } from "./tursoAgentApiTokenRepository";

type NamedArgs = Record<string, InValue>;

function rowValue(row: Row, column: string): InValue | undefined {
  return row[column];
}

function requiredString(row: Row, column: string): string {
  const value = rowValue(row, column);
  if (value === null || value === undefined) {
    throw new Error(`Missing required database column: ${column}`);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Unsupported value for database column: ${column}`);
}

function nullableString(row: Row, column: string): string | null {
  const value = rowValue(row, column);
  if (value === null || value === undefined) return null;
  return requiredString(row, column);
}

function requiredNumber(row: Row, column: string): number {
  const value = rowValue(row, column);
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new Error(`Unsupported numeric value for database column: ${column}`);
}

function applicationStatus(row: Row): JobApplication["status"] {
  const parsed = applicationStatusSchema.safeParse(requiredString(row, "status"));
  if (!parsed.success) {
    throw new Error("Invalid application status in database");
  }
  return parsed.data;
}

function rowToApplicationRow(row: Row): ApplicationRow {
  return {
    id: requiredString(row, "id"),
    url: requiredString(row, "url"),
    linkedin_url: nullableString(row, "linkedin_url"),
    title: nullableString(row, "title"),
    company: nullableString(row, "company"),
    applied_at: requiredString(row, "applied_at"),
    via_recruiter: requiredNumber(row, "via_recruiter"),
    recruiter_name: nullableString(row, "recruiter_name"),
    recruiter_firm: nullableString(row, "recruiter_firm"),
    contact_email: nullableString(row, "contact_email"),
    contact_phone: nullableString(row, "contact_phone"),
    salary_range: nullableString(row, "salary_range"),
    desired_salary: nullableString(row, "desired_salary"),
    full_jd: nullableString(row, "full_jd"),
    status: applicationStatus(row),
    archived: requiredNumber(row, "archived"),
    created_at: requiredString(row, "created_at"),
    updated_at: requiredString(row, "updated_at"),
  };
}

function rowToNoteRow(row: Row): NoteRow {
  return {
    id: requiredString(row, "id"),
    application_id: requiredString(row, "application_id"),
    content: requiredString(row, "content"),
    created_at: requiredString(row, "created_at"),
  };
}

function tursoRowToApplication(row: Row): JobApplication {
  return rowToApplication(rowToApplicationRow(row));
}

function tursoRowToNote(row: Row): ApplicationNote {
  return rowToNote(rowToNoteRow(row));
}

async function rows(client: Client, sql: string, args?: InValue[] | NamedArgs): Promise<Row[]> {
  const result = args === undefined ? await client.execute(sql) : await client.execute({ sql, args });
  return result.rows;
}

async function firstRow(client: Client, sql: string, args?: InValue[] | NamedArgs): Promise<Row | null> {
  const result = await rows(client, sql, args);
  return result[0] ?? null;
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const row = await firstRow(client, `SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
  return row !== null;
}

async function columnExists(client: Client, column: string): Promise<boolean> {
  const result = await rows(client, "PRAGMA table_info(applications)");
  return result.some((row) => nullableString(row, "name") === column);
}

async function agentApiTokenColumnExists(client: Client, column: string): Promise<boolean> {
  if (!(await tableExists(client, "agent_api_tokens"))) {
    return false;
  }
  const result = await rows(client, "PRAGMA table_info(agent_api_tokens)");
  return result.some((row) => nullableString(row, "name") === column);
}

async function migrateLegacyApplicationNotes(client: Client): Promise<void> {
  if (!(await tableExists(client, "application_notes"))) {
    return;
  }

  const apps = await rows(
    client,
    `SELECT id, notes, updated_at FROM applications WHERE notes IS NOT NULL AND trim(notes) <> ''`,
  );
  const statements: InStatement[] = [];

  for (const app of apps) {
    const applicationId = requiredString(app, "id");
    const existing = await firstRow(
      client,
      `SELECT 1 AS found FROM application_notes WHERE application_id = ? LIMIT 1`,
      [applicationId],
    );

    if (existing) {
      continue;
    }

    const note = buildNote(applicationId, requiredString(app, "notes"));
    statements.push({
      sql: INSERT_NOTE_SQL,
      args: [note.id, note.applicationId, note.content, requiredString(app, "updated_at")],
    });
  }

  if (statements.length > 0) {
    await client.batch(statements, "write");
  }

  await client.execute(`UPDATE applications SET notes = NULL WHERE notes IS NOT NULL`);
}

async function migrateTurso(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.executeMultiple(readSchemaSql());

  for (const column of APPLICATION_LEGACY_COLUMNS) {
    if (!(await columnExists(client, column))) {
      await client.execute(`ALTER TABLE applications ADD COLUMN ${column} TEXT`);
    }
  }

  if (!(await columnExists(client, "archived"))) {
    await client.execute(`ALTER TABLE applications ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
  }

  await migrateLegacyApplicationNotes(client);

  if (!(await agentApiTokenColumnExists(client, "last_used_at"))) {
    await client.execute(`ALTER TABLE agent_api_tokens ADD COLUMN last_used_at TEXT`);
  }
}

class TursoJobApplicationRepository implements JobApplicationRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async list(): Promise<JobApplication[]> {
    await this.ready;
    return (await rows(this.client, LIST_APPLICATIONS_SQL)).map(tursoRowToApplication);
  }

  async listByIds(ids: string[]): Promise<JobApplication[]> {
    await this.ready;
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(ids)];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const sql = LIST_APPLICATIONS_SQL.replace("FROM applications", `FROM applications WHERE id IN (${placeholders})`);
    const applications = (await rows(this.client, sql, uniqueIds)).map(tursoRowToApplication);
    const applicationsById = new Map(applications.map((application) => [application.id, application]));

    return uniqueIds.flatMap((id) => {
      const application = applicationsById.get(id);
      return application ? [application] : [];
    });
  }

  async getById(id: string): Promise<JobApplication | null> {
    await this.ready;
    const row = await firstRow(this.client, GET_APPLICATION_BY_ID_SQL, [id]);
    return row ? tursoRowToApplication(row) : null;
  }

  async create(input: ParsedCreateJobApplicationInput): Promise<JobApplication> {
    await this.ready;
    const created = buildApplicationInsertRow(input);

    await this.client.execute({
      sql: INSERT_APPLICATION_SQL,
      args: created,
    });

    const row = await this.getById(created.id);
    if (!row) {
      throw new Error("Failed to create application");
    }
    return row;
  }

  async update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null> {
    await this.ready;
    const existingRow = await firstRow(this.client, GET_APPLICATION_BY_ID_SQL, [id]);
    if (!existingRow) {
      return null;
    }

    const existing = rowToApplicationRow(existingRow);
    const updated = buildApplicationUpdateRow(existing, input);

    await this.client.execute({
      sql: UPDATE_APPLICATION_SQL,
      args: updated,
    });

    return rowToApplication(updated);
  }

  async bulkArchiveByStatuses(statuses: readonly ApplicationStatus[]): Promise<BulkArchiveResult> {
    await this.ready;
    if (statuses.length === 0) {
      return { archivedCount: 0, applications: await this.list() };
    }

    const timestamp = nowIso();
    const sql = buildBulkArchiveByStatusesSql(statuses);
    const result = await this.client.execute({
      sql,
      args: [timestamp, ...statuses],
    });

    return {
      archivedCount: result.rowsAffected,
      applications: await this.list(),
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.ready;
    const result = await this.client.execute({ sql: DELETE_APPLICATION_SQL, args: [id] });
    return result.rowsAffected > 0;
  }
}

class TursoApplicationNoteRepository implements ApplicationNoteRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async listAll(): Promise<ApplicationNote[]> {
    await this.ready;
    return (await rows(this.client, LIST_ALL_NOTES_SQL)).map(tursoRowToNote);
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationNote[]> {
    await this.ready;
    return (await rows(this.client, LIST_NOTES_BY_APPLICATION_SQL, [applicationId])).map(tursoRowToNote);
  }

  async create(applicationId: string, content: string): Promise<ApplicationNote> {
    await this.ready;
    const note = buildNote(applicationId, content);
    await this.client.execute({
      sql: INSERT_NOTE_SQL,
      args: [note.id, note.applicationId, note.content, note.createdAt],
    });

    return note;
  }

  async updateForApplication(applicationId: string, noteId: string, content: string): Promise<ApplicationNote | null> {
    await this.ready;
    const trimmed = trimRequiredNoteContent(content);

    const result = await this.client.execute({
      sql: UPDATE_NOTE_FOR_APPLICATION_SQL,
      args: [trimmed, noteId, applicationId],
    });
    if (result.rowsAffected === 0) {
      return null;
    }

    const row = await firstRow(this.client, GET_NOTE_FOR_APPLICATION_SQL, [noteId, applicationId]);
    return row ? tursoRowToNote(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    await this.ready;
    const result = await this.client.execute({ sql: DELETE_NOTE_SQL, args: [id] });
    return result.rowsAffected > 0;
  }

  async deleteForApplication(applicationId: string, noteId: string): Promise<boolean> {
    await this.ready;
    const result = await this.client.execute({ sql: DELETE_NOTE_FOR_APPLICATION_SQL, args: [noteId, applicationId] });
    return result.rowsAffected > 0;
  }
}

export class TursoDatabaseBackend implements DatabaseBackend {
  readonly provider = "turso";
  readonly applications: JobApplicationRepository;
  readonly notes: ApplicationNoteRepository;
  readonly agentApiTokens;

  private readonly client: Client;
  private readonly ready: Promise<void>;

  constructor(config: TursoDatabaseConfig) {
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
    this.ready = migrateTurso(this.client);
    this.applications = new TursoJobApplicationRepository(this.client, this.ready);
    this.notes = new TursoApplicationNoteRepository(this.client, this.ready);
    this.agentApiTokens = new TursoAgentApiTokenRepository(this.client, this.ready);
  }

  async exportJson(): Promise<BackupJson> {
    await this.ready;
    return createBackupJson(await this.applications.list(), await this.notes.listAll());
  }

  async exportSql(): Promise<string> {
    await this.ready;
    return exportSqlFromRecords(await this.applications.list(), await this.notes.listAll());
  }

  async importJson(raw: unknown, mode: ImportMode) {
    await this.ready;
    const data = parseBackupJson(raw);

    if (mode === "replace") {
      await this.client.execute("DELETE FROM application_notes");
      await this.client.execute("DELETE FROM applications");
    }

    // libsql batch() does not bind named args (@url); execute() does.
    for (const application of data.applications) {
      await this.client.execute({ sql: UPSERT_APPLICATION_SQL, args: applicationToRow(application) });
    }

    for (const note of data.notes) {
      await this.client.execute({ sql: UPSERT_NOTE_SQL, args: noteToRow(note) });
    }

    return {
      applications: await this.applications.list(),
      imported: {
        applications: data.applications.length,
        notes: data.notes.length,
      },
    };
  }

  async importSql(sql: string, mode: ImportMode) {
    await this.ready;
    const trimmed = sql.trim();
    if (trimmed.length === 0) {
      throw new Error("SQL backup is empty");
    }

    const imported = countSqlInserts(trimmed);
    if (mode === "upsert") {
      await this.client.batch(prepareSqlUpsertStatements(trimmed), "write");
    } else {
      await this.client.executeMultiple(trimmed);
      await this.ready;
    }

    return {
      applications: await this.applications.list(),
      imported,
    };
  }

  async createDatabaseBackup() {
    await this.ready;
    return createSqlBackupZip(await this.exportSql(), { databasePath: "turso.db" });
  }

  reset(): void {
    this.client.close();
  }
}
