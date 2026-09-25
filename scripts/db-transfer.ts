#!/usr/bin/env node

import { existsSync } from "node:fs";
import type { ImportMode, TursoSyncMode } from "@/lib/schemas/backup";
import { initLogger, log } from "@/lib/server/logging/logger";
import { loadProjectEnvFiles } from "@/lib/server/loadEnvFile";
import {
  syncSqliteToTurso,
  pullTursoToSqlite,
  pushSqliteToTurso,
  resolveSqlitePath,
  verifySqliteAndTurso,
  type TransferResult,
  type TransferVerification,
} from "@/lib/server/services/databaseTransferService";

type Command = "push" | "pull" | "verify";

type ParsedArgs = {
  command: Command;
  mode: TursoSyncMode;
  sqlitePath?: string;
  tursoUrl?: string;
  help: boolean;
};

function printHelp(): void {
  process.stdout.write(`Usage:
  pnpm db:push-turso [--replace | --upsert] [--sqlite-path PATH] [--turso-url URL]
  pnpm db:pull-turso [--upsert] [--sqlite-path PATH] [--turso-url URL]
  pnpm db:verify-turso [--sqlite-path PATH] [--turso-url URL]

Push defaults to incremental sync (first run establishes a full baseline).
Use --replace to rebuild the baseline. --upsert sends all rows without deleting extras.
Pull defaults to full replace; --upsert merges by ID.

Environment (from .env.local when flags are omitted):
  DATABASE_PATH         Local SQLite file (default: data/applied.db)
  TURSO_DATABASE_URL    Turso libsql URL
  TURSO_AUTH_TOKEN      Turso auth token
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const commandRaw = positional[0];
  const command = commandRaw === "push" || commandRaw === "pull" || commandRaw === "verify" ? commandRaw : null;

  if (!command) {
    return { command: "push", mode: "replace", help: true };
  }

  let mode: TursoSyncMode = command === "push" ? "incremental" : "replace";
  let sqlitePath: string | undefined;
  let tursoUrl: string | undefined;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--replace") {
      mode = "replace";
      continue;
    }
    if (arg === "--upsert") {
      mode = "upsert";
      continue;
    }
    if (arg === "--sqlite-path") {
      sqlitePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--turso-url") {
      tursoUrl = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return { command, mode, sqlitePath, tursoUrl, help };
}

function printVerification(verification: TransferVerification): void {
  process.stdout.write(
    `Source: ${verification.source.applicationCount} application(s), ${verification.source.noteCount} note(s), latest update ${verification.source.latestUpdatedAt ?? "none"}\n`,
  );
  process.stdout.write(
    `Target: ${verification.target.applicationCount} application(s), ${verification.target.noteCount} note(s), latest update ${verification.target.latestUpdatedAt ?? "none"}\n`,
  );

  if (verification.matches) {
    process.stdout.write("Verification: databases match.\n");
    return;
  }

  process.stdout.write("Verification: differences found:\n");
  for (const difference of verification.differences) {
    process.stdout.write(`  - ${difference}\n`);
  }
}

function printTransferResult(direction: "push" | "pull", mode: ImportMode, result: TransferResult): void {
  const verb = direction === "push" ? "Pushed" : "Pulled";
  process.stdout.write(
    `${verb} ${result.imported.applications} application(s) and ${result.imported.notes} note(s) (${mode} mode).\n`,
  );
  printVerification(result.verification);
}

function logTransferVerification(command: Command, verification: TransferVerification): void {
  if (verification.matches) {
    log.debug("db transfer verification matched", { command });
    return;
  }

  log.warn("db transfer verification mismatch", {
    command,
    differences: verification.differences,
  });
}

function logTransferSuccess(direction: "push" | "pull", mode: ImportMode, result: TransferResult): void {
  log.info("db transfer completed", {
    command: direction,
    mode,
    matches: result.verification.matches,
    importedApplications: result.imported.applications,
    importedNotes: result.imported.notes,
  });
  logTransferVerification(direction, result.verification);
}

async function main(): Promise<void> {
  loadProjectEnvFiles();
  await initLogger();

  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    process.exit(parsed.command ? 0 : 1);
  }

  if (parsed.command === "push" || parsed.command === "verify") {
    const sqlitePath = resolveSqlitePath(parsed.sqlitePath);
    if (!existsSync(sqlitePath)) {
      process.stderr.write(`SQLite database not found at ${sqlitePath}\n`);
      process.exit(1);
    }
  }

  try {
    if (parsed.command === "push") {
      if (parsed.mode !== "upsert") {
        const result = await syncSqliteToTurso({ ...parsed, mode: parsed.mode });
        process.stdout.write(
          `${result.mode}: ${JSON.stringify(result.imported)} upserted; ${JSON.stringify(result.deleted)} deleted. ${result.batches} committed batch(es), ${result.payloadBytes} payload bytes.\n`,
        );
        log.info("db incremental sync completed", { ...result });
        process.exit(0);
      }
      const result = await pushSqliteToTurso({ ...parsed, mode: "upsert" });
      printTransferResult("push", parsed.mode, result);
      logTransferSuccess("push", parsed.mode, result);
      process.exit(result.verification.matches ? 0 : 2);
    }

    if (parsed.command === "pull") {
      const mode = parsed.mode === "upsert" ? "upsert" : "replace";
      const result = await pullTursoToSqlite({ ...parsed, mode });
      printTransferResult("pull", mode, result);
      logTransferSuccess("pull", mode, result);
      process.exit(result.verification.matches ? 0 : 2);
    }

    const verification = await verifySqliteAndTurso(parsed);
    printVerification(verification);
    logTransferVerification("verify", verification);
    process.exit(verification.matches ? 0 : 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    log.errorFromUnknown(error, { command: parsed.command });
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

void main();
