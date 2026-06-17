import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import yazl from "yazl";
import { getDefaultDatabasePath } from "@/lib/server/databaseConfig";

export const APP_ACCESS_CONFIG_TABLE = "app_access_config";
export const AGENT_API_TOKENS_TABLE = "agent_api_tokens";

export type DatabaseBackupPayload = {
  filename: string;
  data: Buffer;
};

type CreateDatabaseBackupOptions = {
  createdAt?: Date;
  databasePath?: string;
  tempDir?: string;
};

export function databaseBackupFilename(createdAt = new Date(), databasePath = getDefaultDatabasePath()): string {
  const stamp = createdAt.toISOString().replace(/[:.]/g, "-");
  const dbBaseName = basename(databasePath).replace(/\.db$/i, "");
  return `${dbBaseName}-backup-${stamp}.zip`;
}

export function databaseBackupEntryFilename(createdAt = new Date(), databasePath = getDefaultDatabasePath()): string {
  const stamp = createdAt.toISOString().replace(/[:.]/g, "-");
  const dbBaseName = basename(databasePath).replace(/\.db$/i, "");
  return `${dbBaseName}-backup-${stamp}.db`;
}

export async function createSqlBackupZip(
  sql: string,
  options: CreateDatabaseBackupOptions = {},
): Promise<DatabaseBackupPayload> {
  const tempDir = options.tempDir ?? (await mkdtemp(join(tmpdir(), "applied-sql-backup-")));
  const ownsTempDir = options.tempDir === undefined;
  const tempSqlPath = join(tempDir, `${randomUUID()}.sql`);

  try {
    await writeFile(tempSqlPath, sql);

    const createdAt = options.createdAt ?? new Date();
    const filename = databaseBackupFilename(createdAt, options.databasePath ?? "turso.db");
    const entryFilename = databaseBackupEntryFilename(createdAt, options.databasePath ?? "turso.db").replace(
      /\.db$/i,
      ".sql",
    );
    const data = await zipFile(tempSqlPath, entryFilename);

    return {
      filename,
      data,
    };
  } finally {
    if (ownsTempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

async function zipFile(filePath: string, entryName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    const chunks: Buffer[] = [];

    zipfile.outputStream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    zipfile.outputStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    zipfile.outputStream.on("error", reject);

    zipfile.addFile(filePath, entryName);
    zipfile.end();
  });
}

function deleteTableRowsIfExists(db: Database.Database, tableName: string): void {
  const table = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName);
  if (table) {
    db.exec(`DELETE FROM ${tableName};`);
  }
}

export function stripSensitiveDataFromDatabase(dbPath: string): void {
  const db = new Database(dbPath);
  try {
    deleteTableRowsIfExists(db, APP_ACCESS_CONFIG_TABLE);
    deleteTableRowsIfExists(db, AGENT_API_TOKENS_TABLE);
  } finally {
    db.close();
  }
}

export async function createDatabaseBackup(
  db: Database.Database,
  options: CreateDatabaseBackupOptions = {},
): Promise<DatabaseBackupPayload> {
  const tempDir = options.tempDir ?? (await mkdtemp(join(tmpdir(), "applied-db-backup-")));
  const ownsTempDir = options.tempDir === undefined;
  const tempDbPath = join(tempDir, `${randomUUID()}.db`);

  try {
    await db.backup(tempDbPath);
    stripSensitiveDataFromDatabase(tempDbPath);

    const createdAt = options.createdAt ?? new Date();
    const filename = databaseBackupFilename(createdAt, options.databasePath);
    const entryFilename = databaseBackupEntryFilename(createdAt, options.databasePath);
    const data = await zipFile(tempDbPath, entryFilename);

    return {
      filename,
      data,
    };
  } finally {
    if (ownsTempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
