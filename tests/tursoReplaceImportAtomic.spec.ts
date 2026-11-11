import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";
import { exportSqlFromRecords } from "@/lib/server/services/backupService";
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
      const users = [
        { id: DEFAULT_USER_ID, displayName: "You", email: null as string | null, createdAt: now, updatedAt: now },
      ];

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
      const owner = await backend.users.getCredentialByEmail("o@example.com");
      expect(owner?.id).toBe(DEFAULT_USER_ID);
      expect(owner?.passwordHash).toBe("scrypt$hash");
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

      // A v1 backup without users keeps the current owner, email and hash.
      await backend.importJson(empty, "replace");
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.passwordHash).toBe("scrypt$hash");

      // SQL replace imports bypass the JSON sanitizer; the post-commit pass must still clean full_jd.
      const dirty = { ...incoming, fullJd: "<p>hi</p><script>alert(1)</script>" };
      await backend.importSql(exportSqlFromRecords([dirty], [], users, [], []), "replace");
      const stored = (await backend.getTursoClient().execute("SELECT full_jd FROM applications"))
        .rows[0]?.[0] as string;
      expect(stored).not.toContain("<script");
      expect(stored).toContain("<p>hi</p>");
    } finally {
      await backend.importJson(empty, "replace");
      // The default owner survives replace imports with its hash; clear it so other specs see a passwordless DB.
      await backend.getTursoClient().execute("UPDATE users SET password_hash = NULL");
      backend.reset();
    }
  }, 30_000);

  test("replace restores keep credentials across email collisions and user-less scripts", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });
    const client = backend.getTursoClient();
    const empty = { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] };
    const now = new Date().toISOString();
    const owner = {
      id: DEFAULT_USER_ID,
      displayName: "You",
      email: null as string | null,
      createdAt: now,
      updatedAt: now,
    };
    const other = {
      id: crypto.randomUUID(),
      displayName: "Other",
      email: "o@example.com",
      createdAt: now,
      updatedAt: now,
    };
    const v3 = (users: (typeof owner)[]) => ({ ...empty, version: 3, users, statusHistory: [], companies: [] });
    const setup = async () => {
      await backend.importJson(empty, "replace");
      await client.execute({ sql: "DELETE FROM users WHERE id <> ?", args: [DEFAULT_USER_ID] });
      await client.execute("UPDATE users SET password_hash = NULL");
      await backend.users.ensureDefaultUser();
      await backend.users.setOwnerPassword({ email: "o@example.com", passwordHash: "scrypt$hash", displayName: null });
    };

    try {
      // (a) Backup made before a password existed; another restored user holds the owner's current email.
      await setup();
      await backend.importJson(v3([owner, other]), "replace");
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.id).toBe(DEFAULT_USER_ID);
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.passwordHash).toBe("scrypt$hash");
      const dupes = await client.execute(
        "SELECT email FROM users WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1",
      );
      expect(dupes.rows).toHaveLength(0);

      // (b) Backup omits the owner; that other user keeps the email.
      await setup();
      await backend.importJson(v3([other]), "replace");
      const row = await client.execute({ sql: "SELECT id FROM users WHERE email = ?", args: ["o@example.com"] });
      expect(row.rows.map((r) => r[0])).toEqual([other.id]);

      // SQL script without user rows keeps the current users and login.
      await setup();
      await backend.importSql(exportSqlFromRecords([], [], [], [], []), "replace");
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.passwordHash).toBe("scrypt$hash");

      // Upsert: an incoming user with a new id but the owner's email loses the email; the owner keeps it (JSON and SQL).
      await setup();
      await backend.importJson(v3([other]), "upsert");
      await backend.importSql(exportSqlFromRecords([], [], [{ ...other, id: crypto.randomUUID() }], [], []), "upsert");
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.id).toBe(DEFAULT_USER_ID);
      const total = await client.execute("SELECT COUNT(*) FROM users");
      expect(Number(total.rows[0]?.[0])).toBe(3);

      // Upsert with the owner's older email, now held by another user: the owner keeps the current email and login.
      await client.execute({
        sql: "INSERT INTO users (id, display_name, email, created_at, updated_at) VALUES (?, 'Old', 'old@example.com', ?, ?)",
        args: [crypto.randomUUID(), now, now],
      });
      const oldOwner = { ...owner, email: "old@example.com" };
      await backend.importJson(v3([oldOwner]), "upsert");
      await backend.importSql(exportSqlFromRecords([], [], [oldOwner], [], []), "upsert");
      expect((await backend.users.getCredentialByEmail("o@example.com"))?.passwordHash).toBe("scrypt$hash");
    } finally {
      await client.execute({ sql: "DELETE FROM users WHERE id <> ?", args: [DEFAULT_USER_ID] }).catch(() => undefined);
      await backend.importJson(empty, "replace");
      await client.execute("UPDATE users SET password_hash = NULL");
      backend.reset();
    }
  }, 60_000);

  test("a failing upsert import rolls back entirely; a good one merges", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });
    const empty = { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] };
    const now = new Date().toISOString();
    const users = [
      { id: DEFAULT_USER_ID, displayName: "You", email: null as string | null, createdAt: now, updatedAt: now },
    ];
    const v3 = (applications: unknown[], notes: unknown[] = []) => ({
      ...empty,
      version: 3,
      applications,
      notes,
      users,
      statusHistory: [],
      companies: [],
    });

    try {
      await backend.importJson(empty, "replace");
      const kept = await backend.applications.create(
        createJobApplicationSchema.parse({
          url: "https://jobs.example.com/upsert-keep",
          title: "Keeper",
          company: "Acme",
          appliedAt: "2026-06-01",
        }),
      );
      const incoming = { ...kept, id: crypto.randomUUID(), title: "Incoming" };
      const orphan = { id: crypto.randomUUID(), applicationId: crypto.randomUUID(), content: "x", createdAt: now };

      // Simulate a connection left with FK enforcement off by an earlier failed replace script.
      await backend.getTursoClient().execute("PRAGMA foreign_keys = OFF");
      // The application upsert runs before the orphan note fails; nothing may land.
      await expect(backend.importJson(v3([incoming], [orphan]), "upsert")).rejects.toThrow();
      expect((await backend.applications.list()).map((a) => a.id)).toEqual([kept.id]);
      const pragma = await backend.getTursoClient().execute("PRAGMA foreign_keys");
      expect(Number(pragma.rows[0]?.[0])).toBe(1);

      await backend.importJson(v3([incoming]), "upsert");
      expect((await backend.applications.list()).map((a) => a.id).sort()).toEqual([kept.id, incoming.id].sort());
    } finally {
      await backend.importJson(empty, "replace");
      await backend.getTursoClient().execute("UPDATE users SET password_hash = NULL");
      backend.reset();
    }
  }, 30_000);
});
