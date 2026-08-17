import { createClient, type Client, type InStatement, type Row } from "@tursodatabase/serverless/compat";
import { applicationStatusSchema } from "@/lib/schemas/common";
import type { UpdateUserProfileInput } from "@/lib/schemas/user";
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
  UPSERT_STATUS_HISTORY_SQL,
  UPSERT_USER_SQL,
  statusHistoryToRow,
  userToRow,
} from "../services/backupService";
import {
  buildApplicationInsertRow,
  buildApplicationUpdateRow,
  applicationRowToUpdateArgs,
  buildBulkArchiveByStatusesSql,
  CLEAR_PINNED_ON_ARCHIVED_SQL,
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
import {
  buildStatusHistoryEntry,
  HAS_STATUS_HISTORY_FOR_APPLICATION_SQL,
  INSERT_STATUS_HISTORY_SQL,
  LIST_STATUS_HISTORY_BY_APPLICATION_SQL,
  rowToStatusHistoryEntry,
  type StatusHistoryRow,
} from "./applicationStatusHistoryRepositoryShared";
import {
  buildDefaultUserInsertArgs,
  GET_CREDENTIAL_BY_EMAIL_SQL,
  GET_CREDENTIAL_BY_ID_SQL,
  GET_USER_BY_ID_SQL,
  HAS_PASSWORD_LOGIN_SQL,
  INSERT_DEFAULT_USER_SQL,
  IS_EMAIL_TAKEN_SQL,
  rowToUser,
  SET_OWNER_PASSWORD_SQL,
  UPDATE_PASSWORD_HASH_SQL,
  UPDATE_USER_PROFILE_SQL,
  type SetOwnerPasswordInput,
  type UserRow,
} from "./userRepositoryShared";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import type { ApplicationStatusHistoryEntry, User } from "@/types";
import type { ApplicationStatusHistoryRepository } from "../repositories/applicationStatusHistoryRepository";
import type { UserCredential, UserRepository } from "../repositories/userRepository";
import { APPLICATION_LEGACY_COLUMNS, readSchemaSql } from "./schema";
import { TursoAgentApiTokenRepository } from "./tursoAgentApiTokenRepository";
import { TursoAnalyticsRepository } from "./tursoAnalyticsRepository";
import { nullableString, requiredNumber, requiredString, tursoFirstRow, tursoRows } from "./tursoRowHelpers";

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
    pinned: requiredNumber(row, "pinned"),
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

async function tableExists(client: Client, table: string): Promise<boolean> {
  const row = await tursoFirstRow(client, `SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?`, [
    table,
  ]);
  return row !== null;
}

async function columnExists(client: Client, column: string): Promise<boolean> {
  const result = await tursoRows(client, "PRAGMA table_info(applications)");
  return result.some((row) => nullableString(row, "name") === column);
}

async function agentApiTokenColumnExists(client: Client, column: string): Promise<boolean> {
  if (!(await tableExists(client, "agent_api_tokens"))) {
    return false;
  }
  const result = await tursoRows(client, "PRAGMA table_info(agent_api_tokens)");
  return result.some((row) => nullableString(row, "name") === column);
}

async function userColumnExists(client: Client, column: string): Promise<boolean> {
  if (!(await tableExists(client, "users"))) {
    return false;
  }
  const result = await tursoRows(client, "PRAGMA table_info(users)");
  return result.some((row) => nullableString(row, "name") === column);
}

async function migrateUserCredentials(client: Client): Promise<void> {
  if (!(await tableExists(client, "users"))) {
    return;
  }

  if (!(await userColumnExists(client, "password_hash"))) {
    await client.execute(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  }

  await client.execute(
    `UPDATE users SET email = lower(trim(email)) WHERE email IS NOT NULL AND email <> lower(trim(email))`,
  );
  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL`,
  );
}

async function migrateLegacyApplicationNotes(client: Client): Promise<void> {
  if (!(await tableExists(client, "application_notes"))) {
    return;
  }

  const apps = await tursoRows(
    client,
    `SELECT id, notes, updated_at FROM applications WHERE notes IS NOT NULL AND trim(notes) <> ''`,
  );
  const statements: InStatement[] = [];

  for (const app of apps) {
    const applicationId = requiredString(app, "id");
    const existing = await tursoFirstRow(
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

async function migrateDefaultUser(client: Client): Promise<void> {
  if (!(await tableExists(client, "users"))) {
    return;
  }

  await client.execute({
    sql: INSERT_DEFAULT_USER_SQL,
    args: buildDefaultUserInsertArgs(),
  });
}

async function migrateInitialStatusHistory(client: Client): Promise<void> {
  if (!(await tableExists(client, "application_status_history")) || !(await tableExists(client, "users"))) {
    return;
  }

  await migrateDefaultUser(client);

  const missingCountRow = await tursoFirstRow(
    client,
    `SELECT COUNT(*) AS count FROM applications a
     WHERE NOT EXISTS (
       SELECT 1 FROM application_status_history h WHERE h.application_id = a.id
     )`,
  );
  const missingCount = missingCountRow ? Number(requiredString(missingCountRow, "count")) : 0;
  if (missingCount === 0) {
    return;
  }

  const apps = await tursoRows(
    client,
    `SELECT a.id, a.status, a.created_at FROM applications a
     WHERE NOT EXISTS (
       SELECT 1 FROM application_status_history h WHERE h.application_id = a.id
     )`,
  );

  const statements: InStatement[] = [];
  for (const app of apps) {
    statements.push({
      sql: INSERT_STATUS_HISTORY_SQL,
      args: [
        crypto.randomUUID(),
        requiredString(app, "id"),
        DEFAULT_USER_ID,
        null,
        requiredString(app, "status"),
        requiredString(app, "created_at"),
      ],
    });
  }

  if (statements.length > 0) {
    await client.batch(statements, "write");
  }
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

  if (!(await columnExists(client, "pinned"))) {
    await client.execute(`ALTER TABLE applications ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  }

  await client.execute(CLEAR_PINNED_ON_ARCHIVED_SQL);

  await migrateLegacyApplicationNotes(client);

  if (!(await agentApiTokenColumnExists(client, "last_used_at"))) {
    await client.execute(`ALTER TABLE agent_api_tokens ADD COLUMN last_used_at TEXT`);
  }

  await migrateUserCredentials(client);
  await migrateDefaultUser(client);
  await migrateInitialStatusHistory(client);
}

function rowToUserRow(row: Row): UserRow {
  return {
    id: requiredString(row, "id"),
    display_name: requiredString(row, "display_name"),
    email: nullableString(row, "email"),
    created_at: requiredString(row, "created_at"),
    updated_at: requiredString(row, "updated_at"),
  };
}

function rowToStatusHistoryRow(row: Row): StatusHistoryRow {
  const fromStatus = nullableString(row, "from_status");
  return {
    id: requiredString(row, "id"),
    application_id: requiredString(row, "application_id"),
    user_id: requiredString(row, "user_id"),
    from_status: fromStatus as StatusHistoryRow["from_status"],
    to_status: requiredString(row, "to_status") as StatusHistoryRow["to_status"],
    changed_at: requiredString(row, "changed_at"),
    user_display_name: requiredString(row, "user_display_name"),
  };
}

class TursoUserRepository implements UserRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async getById(id: string): Promise<User | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, GET_USER_BY_ID_SQL, [id]);
    return row ? rowToUser(rowToUserRow(row)) : null;
  }

  async ensureDefaultUser(): Promise<User> {
    await this.ready;
    await this.client.execute({
      sql: INSERT_DEFAULT_USER_SQL,
      args: buildDefaultUserInsertArgs(),
    });

    const user = await this.getById(DEFAULT_USER_ID);
    if (!user) {
      throw new Error("Failed to ensure default user");
    }
    return user;
  }

  async updateProfile(id: string, input: UpdateUserProfileInput): Promise<User | null> {
    await this.ready;
    const updatedAt = nowIso();
    const email = input.email?.toLowerCase() ?? null;
    const result = await this.client.execute({
      sql: UPDATE_USER_PROFILE_SQL,
      args: [input.displayName, email, updatedAt, id],
    });

    if (result.rowsAffected === 0) {
      return null;
    }

    return this.getById(id);
  }

  async hasPasswordLogin(): Promise<boolean> {
    await this.ready;
    const row = await tursoFirstRow(this.client, HAS_PASSWORD_LOGIN_SQL);
    return row !== null;
  }

  async getCredentialByEmail(email: string): Promise<UserCredential | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, GET_CREDENTIAL_BY_EMAIL_SQL, [email.toLowerCase()]);
    if (!row) {
      return null;
    }
    return {
      id: requiredString(row, "id"),
      passwordHash: requiredString(row, "password_hash"),
    };
  }

  async getCredentialById(id: string): Promise<UserCredential | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, GET_CREDENTIAL_BY_ID_SQL, [id]);
    if (!row) {
      return null;
    }
    return {
      id: requiredString(row, "id"),
      passwordHash: requiredString(row, "password_hash"),
    };
  }

  async setOwnerPassword(input: SetOwnerPasswordInput): Promise<boolean> {
    await this.ready;
    const updatedAt = nowIso();
    const result = await this.client.execute({
      sql: SET_OWNER_PASSWORD_SQL,
      args: [input.email.toLowerCase(), input.passwordHash, input.displayName ?? null, updatedAt, DEFAULT_USER_ID],
    });
    return result.rowsAffected > 0;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    await this.ready;
    const updatedAt = nowIso();
    const result = await this.client.execute({
      sql: UPDATE_PASSWORD_HASH_SQL,
      args: [passwordHash, updatedAt, userId],
    });
    return result.rowsAffected > 0;
  }

  async isEmailTaken(email: string, excludeUserId: string): Promise<boolean> {
    await this.ready;
    const row = await tursoFirstRow(this.client, IS_EMAIL_TAKEN_SQL, [email.toLowerCase(), excludeUserId]);
    return row !== null;
  }
}

class TursoApplicationStatusHistoryRepository implements ApplicationStatusHistoryRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
    private readonly users: UserRepository,
  ) {}

  async listByApplicationId(applicationId: string): Promise<ApplicationStatusHistoryEntry[]> {
    await this.ready;
    return (await tursoRows(this.client, LIST_STATUS_HISTORY_BY_APPLICATION_SQL, [applicationId])).map((row) =>
      rowToStatusHistoryEntry(rowToStatusHistoryRow(row)),
    );
  }

  async record(
    input: Parameters<ApplicationStatusHistoryRepository["record"]>[0],
  ): Promise<ApplicationStatusHistoryEntry> {
    await this.ready;
    const entry = buildStatusHistoryEntry(input);

    await this.client.execute({
      sql: INSERT_STATUS_HISTORY_SQL,
      args: [entry.id, entry.applicationId, entry.userId, entry.fromStatus, entry.toStatus, entry.changedAt],
    });

    const user = await this.users.getById(entry.userId);
    return {
      ...entry,
      userDisplayName: user?.displayName ?? "Unknown",
    };
  }

  async hasAnyForApplication(applicationId: string): Promise<boolean> {
    await this.ready;
    const row = await tursoFirstRow(this.client, HAS_STATUS_HISTORY_FOR_APPLICATION_SQL, [applicationId]);
    return row !== null;
  }
}

class TursoJobApplicationRepository implements JobApplicationRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async list(): Promise<JobApplication[]> {
    await this.ready;
    return (await tursoRows(this.client, LIST_APPLICATIONS_SQL)).map(tursoRowToApplication);
  }

  async listByIds(ids: string[]): Promise<JobApplication[]> {
    await this.ready;
    if (ids.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(ids)];
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const sql = LIST_APPLICATIONS_SQL.replace("FROM applications", `FROM applications WHERE id IN (${placeholders})`);
    const applications = (await tursoRows(this.client, sql, uniqueIds)).map(tursoRowToApplication);
    const applicationsById = new Map(applications.map((application) => [application.id, application]));

    return uniqueIds.flatMap((id) => {
      const application = applicationsById.get(id);
      return application ? [application] : [];
    });
  }

  async getById(id: string): Promise<JobApplication | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, GET_APPLICATION_BY_ID_SQL, [id]);
    return row ? tursoRowToApplication(row) : null;
  }

  async create(input: ParsedCreateJobApplicationInput): Promise<JobApplication> {
    await this.ready;
    const created = buildApplicationInsertRow(input);
    const history = buildStatusHistoryEntry({
      applicationId: created.id,
      userId: DEFAULT_USER_ID,
      fromStatus: null,
      toStatus: created.status,
      changedAt: created.created_at,
    });

    await this.client.execute({
      sql: INSERT_DEFAULT_USER_SQL,
      args: buildDefaultUserInsertArgs(),
    });
    await this.client.execute({
      sql: INSERT_APPLICATION_SQL,
      args: created,
    });
    await this.client.execute({
      sql: INSERT_STATUS_HISTORY_SQL,
      args: [
        history.id,
        history.applicationId,
        history.userId,
        history.fromStatus,
        history.toStatus,
        history.changedAt,
      ],
    });

    const row = await this.getById(created.id);
    if (!row) {
      throw new Error("Failed to create application");
    }
    return row;
  }

  async update(id: string, input: Partial<ParsedCreateJobApplicationInput>): Promise<JobApplication | null> {
    await this.ready;
    const existingRow = await tursoFirstRow(this.client, GET_APPLICATION_BY_ID_SQL, [id]);
    if (!existingRow) {
      return null;
    }

    const existing = rowToApplicationRow(existingRow);
    const updated = buildApplicationUpdateRow(existing, input);

    await this.client.execute({
      sql: UPDATE_APPLICATION_SQL,
      args: applicationRowToUpdateArgs(updated),
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
    return (await tursoRows(this.client, LIST_ALL_NOTES_SQL)).map(tursoRowToNote);
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationNote[]> {
    await this.ready;
    return (await tursoRows(this.client, LIST_NOTES_BY_APPLICATION_SQL, [applicationId])).map(tursoRowToNote);
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

    const row = await tursoFirstRow(this.client, GET_NOTE_FOR_APPLICATION_SQL, [noteId, applicationId]);
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
  readonly statusHistory: ApplicationStatusHistoryRepository;
  readonly analytics;
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
    this.statusHistory = new TursoApplicationStatusHistoryRepository(this.client, this.ready, this.users);
    this.analytics = new TursoAnalyticsRepository(this.client, this.ready);
    this.agentApiTokens = new TursoAgentApiTokenRepository(this.client, this.ready);
  }

  get users(): UserRepository {
    return new TursoUserRepository(this.client, this.ready);
  }

  async exportJson(): Promise<BackupJson> {
    await this.ready;
    const users = (
      await tursoRows(
        this.client,
        `SELECT id, display_name, email, created_at, updated_at FROM users ORDER BY created_at ASC`,
      )
    ).map((row) => ({
      id: requiredString(row, "id"),
      displayName: requiredString(row, "display_name"),
      email: nullableString(row, "email"),
      createdAt: requiredString(row, "created_at"),
      updatedAt: requiredString(row, "updated_at"),
    }));
    const statusHistory = (
      await tursoRows(
        this.client,
        `SELECT id, application_id, user_id, from_status, to_status, changed_at
         FROM application_status_history
         ORDER BY changed_at ASC`,
      )
    ).map((row) => ({
      id: requiredString(row, "id"),
      applicationId: requiredString(row, "application_id"),
      userId: requiredString(row, "user_id"),
      fromStatus: nullableString(row, "from_status") as BackupJson["statusHistory"][number]["fromStatus"],
      toStatus: requiredString(row, "to_status") as BackupJson["statusHistory"][number]["toStatus"],
      changedAt: requiredString(row, "changed_at"),
    }));

    return createBackupJson(await this.applications.list(), await this.notes.listAll(), users, statusHistory);
  }

  async exportSql(): Promise<string> {
    await this.ready;
    const exported = await this.exportJson();
    return exportSqlFromRecords(exported.applications, exported.notes, exported.users, exported.statusHistory);
  }

  async importJson(raw: unknown, mode: ImportMode) {
    await this.ready;
    const data = parseBackupJson(raw);

    if (mode === "replace") {
      await this.client.execute("DELETE FROM application_status_history");
      await this.client.execute("DELETE FROM application_notes");
      await this.client.execute("DELETE FROM applications");
      await this.client.execute("DELETE FROM users");
    }

    for (const user of data.users) {
      await this.client.execute({ sql: UPSERT_USER_SQL, args: userToRow(user) });
    }

    for (const application of data.applications) {
      await this.client.execute({ sql: UPSERT_APPLICATION_SQL, args: applicationToRow(application) });
    }

    for (const note of data.notes) {
      await this.client.execute({ sql: UPSERT_NOTE_SQL, args: noteToRow(note) });
    }

    for (const entry of data.statusHistory) {
      await this.client.execute({ sql: UPSERT_STATUS_HISTORY_SQL, args: statusHistoryToRow(entry) });
    }

    if (data.statusHistory.length === 0) {
      await migrateInitialStatusHistory(this.client);
    }

    return {
      applications: await this.applications.list(),
      imported: {
        applications: data.applications.length,
        notes: data.notes.length,
        users: data.users.length,
        statusHistory: data.statusHistory.length,
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

  getTursoClient(): Client {
    return this.client;
  }
}
