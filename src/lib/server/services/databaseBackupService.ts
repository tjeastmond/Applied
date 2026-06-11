import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import yazl from "yazl";
import { getDefaultDatabasePath } from "@/lib/server/databaseConfig";

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
  const tempDir = options.tempDir ?? mkdtempSync(join(tmpdir(), "applied-sql-backup-"));
  const ownsTempDir = options.tempDir === undefined;
  const tempSqlPath = join(tempDir, `${randomUUID()}.sql`);

  try {
    writeFileSync(tempSqlPath, sql);

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
      rmSync(tempDir, { recursive: true, force: true });
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

export async function createDatabaseBackup(
  db: Database.Database,
  options: CreateDatabaseBackupOptions = {},
): Promise<DatabaseBackupPayload> {
  const tempDir = options.tempDir ?? mkdtempSync(join(tmpdir(), "applied-db-backup-"));
  const ownsTempDir = options.tempDir === undefined;
  const tempDbPath = join(tempDir, `${randomUUID()}.db`);

  try {
    await db.backup(tempDbPath);

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
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
