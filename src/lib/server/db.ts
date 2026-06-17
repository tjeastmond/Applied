import Database from "better-sqlite3";
import { log } from "@/lib/server/logging/logger";
import { hostFromUrl } from "@/lib/server/logging/sanitize";
import { getDefaultDatabasePath, readDatabaseConfig } from "./databaseConfig";
import type { DatabaseBackend } from "./databaseBackend";
import { SqliteDatabaseBackend } from "./db/sqliteBackend";
import { TursoDatabaseBackend } from "./db/tursoBackend";
import type { ApplicationNoteRepository } from "./repositories/applicationNoteRepository";
import type { AppAccessConfigRepository } from "./repositories/appAccessConfigRepository";
import type { AgentApiTokenRepository } from "./repositories/agentApiTokenRepository";
import type { JobApplicationRepository } from "./repositories/jobApplicationRepository";

const globalForDb = globalThis as unknown as {
  backend?: DatabaseBackend;
};

export function getDatabasePath(): string {
  const config = readDatabaseConfig();
  return config.provider === "sqlite" ? config.path : getDefaultDatabasePath();
}

export function getDatabaseBackend(): DatabaseBackend {
  if (!globalForDb.backend) {
    const config = readDatabaseConfig();
    globalForDb.backend =
      config.provider === "sqlite" ? new SqliteDatabaseBackend(config) : new TursoDatabaseBackend(config);

    if (config.provider === "sqlite") {
      log.info("database backend ready", { provider: config.provider, path: config.path });
    } else {
      log.info("database backend ready", {
        provider: config.provider,
        tursoHost: hostFromUrl(config.url),
      });
    }
  }

  return globalForDb.backend;
}

export function getRepository(): JobApplicationRepository {
  return getDatabaseBackend().applications;
}

export function getNoteRepository(): ApplicationNoteRepository {
  return getDatabaseBackend().notes;
}

export function getAppAccessConfigRepository(): AppAccessConfigRepository | null {
  return getDatabaseBackend().appAccessConfig ?? null;
}

export function getAgentApiTokenRepository(): AgentApiTokenRepository | null {
  return getDatabaseBackend().agentApiTokens ?? null;
}

export function getDatabase(): Database.Database {
  const db = getDatabaseBackend().getSqliteDatabase?.();
  if (!db) {
    throw new Error("Raw SQLite database access is only available when DATABASE_PROVIDER=sqlite");
  }
  return db;
}

/** Drop cached backend and repositories so they are recreated after schema/data changes. */
export function resetDatabaseBackend(): void {
  globalForDb.backend?.reset();
  globalForDb.backend = undefined;
}

/** Point route handlers at an in-memory DB during tests. */
export function useTestDatabase(db: Database.Database): void {
  globalForDb.backend = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, db);
}
