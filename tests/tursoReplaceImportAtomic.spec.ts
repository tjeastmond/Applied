import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import { requireTursoTestConfig } from "./helpers/tursoTestConfig";

describe("TursoDatabaseBackend replace import atomicity", () => {
  test("a failing last row rolls back the whole replace import", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });
    const empty = { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] };

    try {
      await backend.importJson(empty, "replace");
      const kept = await backend.applications.create(
        createJobApplicationSchema.parse({
          url: "https://jobs.example.com/atomic-keep",
          title: "Keeper",
          company: "Acme",
          appliedAt: "2026-06-01",
        }),
      );
      const incoming = { ...kept, id: crypto.randomUUID(), title: "Incoming" };
      const now = new Date().toISOString();
      const entry = {
        id: crypto.randomUUID(),
        applicationId: incoming.id,
        userId: DEFAULT_USER_ID,
        fromStatus: null,
        toStatus: "applied" as const,
        changedAt: new Date().toISOString(),
      };
      const users = [{ id: DEFAULT_USER_ID, displayName: "You", email: null, createdAt: now, updatedAt: now }];

      await expect(
        backend.importJson(
          {
            version: 3,
            exportedAt: new Date().toISOString(),
            applications: [incoming],
            notes: [],
            users,
            // Duplicate primary key: the last INSERT fails after the DROPs and earlier INSERTs ran.
            statusHistory: [entry, entry],
            companies: [],
          },
          "replace",
        ),
      ).rejects.toThrow();

      // Old data survives the failed import and foreign keys are enforced again.
      expect((await backend.applications.list()).map((a) => a.id)).toEqual([kept.id]);
      const pragma = await backend.getTursoClient().execute("PRAGMA foreign_keys");
      expect(Number(pragma.rows[0]?.[0])).toBe(1);

      // An orphan note is rejected before the DB is touched.
      const orphanNote = { id: crypto.randomUUID(), applicationId: crypto.randomUUID(), content: "x", createdAt: now };
      await expect(
        backend.importJson({ ...empty, applications: [incoming], notes: [orphanNote] }, "replace"),
      ).rejects.toThrow(/missing applications or users/);
      expect((await backend.applications.list()).map((a) => a.id)).toEqual([kept.id]);

      // A successful replace must leave the migrated schema (password_hash) in place without a reset.
      await backend.importJson(empty, "replace");
      await expect(backend.users.hasPasswordLogin()).resolves.toBe(false);
    } finally {
      await backend.importJson(empty, "replace");
      backend.reset();
    }
  }, 30_000);
});
