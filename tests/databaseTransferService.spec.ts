import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import {
  collectTransferSnapshot,
  compareTransferSnapshots,
  isTursoSyncAvailable,
  resolveSqlitePath,
  resolveTursoTarget,
  transferBetweenBackends,
  verifyBetweenBackends,
} from "@/lib/server/services/databaseTransferService";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteDatabaseBackend } from "@/lib/server/db/sqliteBackend";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";

const tursoTestUrl = process.env.TURSO_TEST_DATABASE_URL;
const tursoTestAuthToken = process.env.TURSO_TEST_AUTH_TOKEN;
const describeWithTurso = tursoTestUrl && tursoTestAuthToken ? describe : describe.skip;

describe("databaseTransferService", () => {
  test("compareTransferSnapshots reports count and timestamp differences", () => {
    const verification = compareTransferSnapshots(
      { applicationCount: 2, noteCount: 3, latestUpdatedAt: "2026-06-02T00:00:00.000Z" },
      { applicationCount: 1, noteCount: 3, latestUpdatedAt: "2026-06-01T00:00:00.000Z" },
    );

    expect(verification.matches).toBe(false);
    expect(verification.differences).toContain("application count differs (source 2, target 1)");
    expect(verification.differences).toContain(
      "latest application updatedAt differs (source 2026-06-02T00:00:00.000Z, target 2026-06-01T00:00:00.000Z)",
    );
  });

  test("transferBetweenBackends upserts sqlite data into an empty target", async () => {
    const sourceDb = openDatabase(":memory:");
    const targetDb = openDatabase(":memory:");
    const source = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, sourceDb);
    const target = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, targetDb);

    const created = await source.applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/transfer",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );
    await source.notes.create(created.id, "Follow up.");

    const result = await transferBetweenBackends(source, target, "upsert");

    expect(result.imported.applications).toBe(1);
    expect(result.imported.notes).toBe(1);
    expect(result.verification.matches).toBe(true);
    expect(await target.applications.list()).toHaveLength(1);
    expect(await target.notes.listAll()).toHaveLength(1);
  });

  test("transferBetweenBackends replace mode clears extra target records", async () => {
    const sourceDb = openDatabase(":memory:");
    const targetDb = openDatabase(":memory:");
    const source = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, sourceDb);
    const target = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, targetDb);

    await source.applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/source",
        title: "Source Role",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );

    await target.applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/extra",
        title: "Extra Role",
        company: "Other",
        appliedAt: "2026-06-02",
        status: "applied",
      }),
    );

    const result = await transferBetweenBackends(source, target, "replace");

    expect(result.verification.matches).toBe(true);
    expect(await target.applications.list()).toHaveLength(1);
    expect((await target.applications.list())[0]?.company).toBe("Acme");
  });

  test("verifyBetweenBackends compares snapshots without transferring", async () => {
    const db = openDatabase(":memory:");
    const backend = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, db);

    await backend.applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/verify",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );

    const verification = await verifyBetweenBackends(backend, backend);
    expect(verification.matches).toBe(true);
    expect(await collectTransferSnapshot(backend)).toEqual(verification.source);
  });

  test("resolveSqlitePath prefers explicit path", () => {
    expect(resolveSqlitePath("/tmp/custom.db")).toBe("/tmp/custom.db");
  });

  test("resolveTursoTarget requires url and token", () => {
    expect(() => resolveTursoTarget({})).toThrow("TURSO_DATABASE_URL is required");
    expect(() => resolveTursoTarget({ tursoUrl: "libsql://example.turso.io" })).toThrow("TURSO_AUTH_TOKEN is required");
    expect(
      resolveTursoTarget({
        tursoUrl: " libsql://example.turso.io ",
        tursoAuthToken: " token ",
      }),
    ).toEqual({
      tursoUrl: "libsql://example.turso.io",
      tursoAuthToken: "token",
    });
  });

  test("isTursoSyncAvailable requires development sqlite and turso credentials", () => {
    expect(
      isTursoSyncAvailable({
        NODE_ENV: "development",
        DATABASE_PROVIDER: "sqlite",
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "token",
      }),
    ).toBe(true);

    expect(
      isTursoSyncAvailable({
        NODE_ENV: "production",
        DATABASE_PROVIDER: "sqlite",
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "token",
      }),
    ).toBe(false);

    expect(
      isTursoSyncAvailable({
        NODE_ENV: "development",
        DATABASE_PROVIDER: "turso",
        TURSO_DATABASE_URL: "libsql://example.turso.io",
        TURSO_AUTH_TOKEN: "token",
      }),
    ).toBe(false);

    expect(
      isTursoSyncAvailable({
        NODE_ENV: "development",
        DATABASE_PROVIDER: "sqlite",
      }),
    ).toBe(false);
  });
});

describeWithTurso("pushSqliteToTurso integration", () => {
  test("pushes in-memory sqlite export into Turso", async () => {
    const sourceDb = openDatabase(":memory:");
    const source = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, sourceDb);

    await source.applications.create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/turso-push",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-01",
        status: "applied",
      }),
    );

    const turso = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoTestUrl!,
      authToken: tursoTestAuthToken!,
    });

    try {
      await turso.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );

      const backup = await source.exportJson();
      const importResult = await turso.importJson(backup, "replace");
      const verification = compareTransferSnapshots(
        await collectTransferSnapshot(source),
        await collectTransferSnapshot(turso),
      );

      expect(importResult.imported.applications).toBe(1);
      expect(verification.matches).toBe(true);
    } finally {
      await turso.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );
      turso.reset();
    }
  });
});
