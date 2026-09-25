import { expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteDatabaseBackend } from "@/lib/server/db/sqliteBackend";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { syncIncrementally } from "@/lib/server/services/incrementalSyncService";
import { createTursoSyncTarget } from "@/lib/server/services/tursoSyncTarget";
import { requireTursoTestConfig } from "./helpers/tursoTestConfig";

function comparable(backup: Awaited<ReturnType<SqliteDatabaseBackend["exportJson"]>>) {
  return Object.fromEntries(
    Object.entries(backup)
      .filter(([key]) => key !== "exportedAt")
      .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort((a, b) => a.id.localeCompare(b.id)) : value]),
  );
}

test("real Turso: resumable baseline, five-table equality, small delta, deletion, and no-op", async () => {
  const config = requireTursoTestConfig();
  const db = openDatabase(":memory:");
  const source = new SqliteDatabaseBackend({ provider: "sqlite", path: ":memory:" }, db);
  let remote = new TursoDatabaseBackend({ provider: "turso", ...config });
  const empty = { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] };
  try {
    await remote.importJson(empty, "replace");
    await source.companies.create({ name: "Sync test" });
    const ids: string[] = [];
    for (let i = 0; i < 26; i++) {
      const app = await source.applications.create(
        createJobApplicationSchema.parse({
          title: `Role ${i}`,
          company: "Sync test",
          url: `https://example.com/sync/${i}`,
          appliedAt: "2026-09-21",
          fullJd: "Job description ".repeat(200),
        }),
      );
      ids.push(app.id);
    }
    const note = await source.notes.create(ids[0], "Before");
    let target = createTursoSyncTarget(remote.getTursoClient());
    let calls = 0;
    await expect(
      syncIncrementally(
        db,
        {
          ...target,
          async applySyncBatch(batch) {
            await target.applySyncBatch(batch);
            if (++calls === 1) throw new Error("Lost acknowledgement after commit");
          },
        },
        "integration",
      ),
    ).rejects.toThrow("Lost acknowledgement");
    remote.reset();
    remote = new TursoDatabaseBackend({ provider: "turso", ...config });
    await remote.ensureReady();
    target = createTursoSyncTarget(remote.getTursoClient());
    const baseline = await syncIncrementally(db, target, "integration");
    expect(baseline.batches).toBeGreaterThan(1);
    expect(comparable(await remote.exportJson())).toEqual(comparable(await source.exportJson()));
    db.prepare("UPDATE applications SET title = 'Changed' WHERE id = ?").run(ids[0]);
    db.prepare("UPDATE application_notes SET content = 'Edited without timestamp' WHERE id = ?").run(note.id);
    await source.applications.delete(ids[1]);
    const delta = await syncIncrementally(db, target, "integration");
    expect(delta.imported).toMatchObject({ applications: 1, notes: 1 });
    expect(delta.deleted).toMatchObject({ applications: 1, statusHistory: 1 });
    expect(delta.payloadBytes).toBeLessThan(baseline.payloadBytes / 10);
    expect(comparable(await remote.exportJson())).toEqual(comparable(await source.exportJson()));
    expect(await syncIncrementally(db, target, "integration")).toMatchObject({ batches: 0, payloadBytes: 0 });
    expect((await remote.getTursoClient().execute("PRAGMA foreign_key_check")).rows).toEqual([]);
    process.stdout.write(
      `Sync evidence: baseline ${baseline.payloadBytes} bytes in ${baseline.batches} batches; delta ${delta.payloadBytes} bytes; unchanged 0 bytes. All five tables equal.\n`,
    );
    await remote.importJson(empty, "replace");
    await expect(syncIncrementally(db, target, "integration")).rejects.toThrow("checkpoint changed");
  } finally {
    await remote.importJson(empty, "replace");
    remote.reset();
    db.close();
  }
}, 120_000);
