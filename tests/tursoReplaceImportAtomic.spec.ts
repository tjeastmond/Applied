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
      // Other specs may leave an owner hash behind, and replace imports now preserve it.
      await backend.getTursoClient().execute("UPDATE users SET password_hash = NULL");
      await expect(backend.users.hasPasswordLogin()).resolves.toBe(false);

      // A replace restore keeps the password hash of a user that still exists in the backup.
      await backend.users.ensureDefaultUser();
      await backend.users.setOwnerPassword({ email: "o@example.com", passwordHash: "scrypt$hash", displayName: null });
      await backend.importJson({ ...empty, version: 3, users, statusHistory: [], companies: [] }, "replace");
      await expect(backend.users.hasPasswordLogin()).resolves.toBe(true);
      // The backup user has email null; the restored owner keeps its email and hash so login still works.
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.passwordHash).toBe("scrypt$hash");

      // Another restored user holding the owner's email must not break the restore or the unique index.
      const other = {
        id: crypto.randomUUID(),
        displayName: "Other",
        email: "o@example.com",
        createdAt: now,
        updatedAt: now,
      };
      await backend.importJson(
        { ...empty, version: 3, users: [...users, other], statusHistory: [], companies: [] },
        "replace",
      );
      expect((await backend.users.getCredentialById(DEFAULT_USER_ID))?.passwordHash).toBe("scrypt$hash");
      const dupes = await backend
        .getTursoClient()
        .execute("SELECT email FROM users WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1");
      expect(dupes.rows).toHaveLength(0);
      await backend.importJson({ ...empty, version: 3, users, statusHistory: [], companies: [] }, "replace");
      await backend
        .getTursoClient()
        .execute({ sql: "UPDATE users SET email = ? WHERE id = ?", args: ["o@example.com", DEFAULT_USER_ID] });

      // A failed replace leaves email and hash unchanged.
      await expect(
        backend.importJson(
          {
            ...empty,
            version: 3,
            applications: [incoming],
            users,
            statusHistory: [entry, entry],
            companies: [],
          },
          "replace",
        ),
      ).rejects.toThrow();
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.passwordHash).toBe("scrypt$hash");
    } finally {
      await backend.importJson(empty, "replace");
      // The default owner survives replace imports with its hash; clear it so other specs see a passwordless DB.
      await backend.getTursoClient().execute("UPDATE users SET password_hash = NULL");
      backend.reset();
    }
  }, 30_000);
});
