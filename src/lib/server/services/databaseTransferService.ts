import type { ImportMode } from "@/lib/schemas/backup";
import type { DatabaseBackend } from "../databaseBackend";
import { getDefaultDatabasePath, readDatabaseConfig, type TursoDatabaseConfig } from "../databaseConfig";
import { SqliteDatabaseBackend } from "../db/sqliteBackend";
import { TursoDatabaseBackend } from "../db/tursoBackend";
import type { ImportResult } from "./backupService";

export type DatabaseTransferSnapshot = {
  applicationCount: number;
  noteCount: number;
  latestUpdatedAt: string | null;
};

export type TransferVerification = {
  source: DatabaseTransferSnapshot;
  target: DatabaseTransferSnapshot;
  matches: boolean;
  differences: string[];
};

export type TransferResult = {
  imported: ImportResult["imported"];
  verification: TransferVerification;
};

export type TursoTransferTarget = {
  tursoUrl: string;
  tursoAuthToken: string;
};

export type DatabaseTransferOptions = {
  mode: ImportMode;
  sqlitePath?: string;
  tursoUrl?: string;
  tursoAuthToken?: string;
};

type TransferBackends = {
  sqlite: SqliteDatabaseBackend;
  turso: TursoDatabaseBackend;
};

export function resolveSqlitePath(sqlitePath?: string): string {
  return sqlitePath?.trim() || process.env.DATABASE_PATH?.trim() || getDefaultDatabasePath();
}

export function resolveTursoTarget(
  options: Pick<DatabaseTransferOptions, "tursoUrl" | "tursoAuthToken">,
): TursoTransferTarget {
  const tursoUrl = options.tursoUrl?.trim() || process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = options.tursoAuthToken?.trim() || process.env.TURSO_AUTH_TOKEN?.trim();

  if (!tursoUrl) {
    throw new Error("TURSO_DATABASE_URL is required (set in .env.local or pass --turso-url)");
  }

  if (!tursoAuthToken) {
    throw new Error("TURSO_AUTH_TOKEN is required (set TURSO_AUTH_TOKEN in .env.local)");
  }

  return { tursoUrl, tursoAuthToken };
}

export function isTursoSyncConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const tursoUrl = env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = env.TURSO_AUTH_TOKEN?.trim();
  return Boolean(tursoUrl && tursoAuthToken);
}

export function isTursoSyncAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "development") {
    return false;
  }

  if (readDatabaseConfig(env).provider !== "sqlite") {
    return false;
  }

  return isTursoSyncConfigured(env);
}

function createSqliteBackend(sqlitePath: string): SqliteDatabaseBackend {
  return new SqliteDatabaseBackend({ provider: "sqlite", path: sqlitePath });
}

function createTursoBackend(config: TursoTransferTarget): TursoDatabaseBackend {
  const tursoConfig: TursoDatabaseConfig = {
    provider: "turso",
    url: config.tursoUrl,
    authToken: config.tursoAuthToken,
  };
  return new TursoDatabaseBackend(tursoConfig);
}

async function withSqliteAndTursoBackends<T>(
  options: Omit<DatabaseTransferOptions, "mode">,
  run: (backends: TransferBackends) => Promise<T>,
): Promise<T> {
  const sqlitePath = resolveSqlitePath(options.sqlitePath);
  const tursoTarget = resolveTursoTarget(options);
  const sqlite = createSqliteBackend(sqlitePath);
  const turso = createTursoBackend(tursoTarget);

  try {
    return await run({ sqlite, turso });
  } finally {
    turso.reset();
  }
}

export async function collectTransferSnapshot(backend: DatabaseBackend): Promise<DatabaseTransferSnapshot> {
  const applications = await backend.applications.list();
  const notes = await backend.notes.listAll();

  let latestUpdatedAt: string | null = null;
  for (const application of applications) {
    if (!latestUpdatedAt || application.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = application.updatedAt;
    }
  }

  return {
    applicationCount: applications.length,
    noteCount: notes.length,
    latestUpdatedAt,
  };
}

export function compareTransferSnapshots(
  source: DatabaseTransferSnapshot,
  target: DatabaseTransferSnapshot,
): TransferVerification {
  const differences: string[] = [];

  if (source.applicationCount !== target.applicationCount) {
    differences.push(
      `application count differs (source ${source.applicationCount}, target ${target.applicationCount})`,
    );
  }

  if (source.noteCount !== target.noteCount) {
    differences.push(`note count differs (source ${source.noteCount}, target ${target.noteCount})`);
  }

  if (source.latestUpdatedAt !== target.latestUpdatedAt) {
    differences.push(
      `latest application updatedAt differs (source ${source.latestUpdatedAt ?? "none"}, target ${target.latestUpdatedAt ?? "none"})`,
    );
  }

  return {
    source,
    target,
    matches: differences.length === 0,
    differences,
  };
}

export async function transferBetweenBackends(
  source: DatabaseBackend,
  target: DatabaseBackend,
  mode: ImportMode,
): Promise<TransferResult> {
  const sourceSnapshot = await collectTransferSnapshot(source);
  const backup = await source.exportJson();
  const importResult = await target.importJson(backup, mode);
  const targetSnapshot = await collectTransferSnapshot(target);

  return {
    imported: importResult.imported,
    verification: compareTransferSnapshots(sourceSnapshot, targetSnapshot),
  };
}

export async function verifyBetweenBackends(
  source: DatabaseBackend,
  target: DatabaseBackend,
): Promise<TransferVerification> {
  const sourceSnapshot = await collectTransferSnapshot(source);
  const targetSnapshot = await collectTransferSnapshot(target);
  return compareTransferSnapshots(sourceSnapshot, targetSnapshot);
}

export async function pushSqliteToTurso(options: DatabaseTransferOptions): Promise<TransferResult> {
  return withSqliteAndTursoBackends(options, ({ sqlite, turso }) =>
    transferBetweenBackends(sqlite, turso, options.mode),
  );
}

export async function pullTursoToSqlite(options: DatabaseTransferOptions): Promise<TransferResult> {
  return withSqliteAndTursoBackends(options, ({ sqlite, turso }) =>
    transferBetweenBackends(turso, sqlite, options.mode),
  );
}

export async function verifySqliteAndTurso(
  options: Omit<DatabaseTransferOptions, "mode">,
): Promise<TransferVerification> {
  return withSqliteAndTursoBackends(options, ({ sqlite, turso }) => verifyBetweenBackends(sqlite, turso));
}
