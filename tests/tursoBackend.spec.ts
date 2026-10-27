import { describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";
import { requireTursoTestConfig } from "./helpers/tursoTestConfig";

describe("TursoDatabaseBackend", () => {
  test("importJson backfills status history when backup omits statusHistory", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });

    try {
      const created = await backend.applications.create(
        createJobApplicationSchema.parse({
          url: "https://jobs.example.com/turso-backfill",
          title: "Engineer",
          company: "Acme",
          appliedAt: "2026-06-01",
          status: "applied",
        }),
      );

      await backend.importJson(
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          applications: [created],
          notes: [],
          users: [],
          statusHistory: [],
        },
        "replace",
      );

      const history = await backend.statusHistory.listByApplicationId(created.id);
      expect(history).toHaveLength(1);
      expect(history[0]?.toStatus).toBe("applied");
    } finally {
      await backend.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );
      backend.reset();
    }
  });

  test("matches core application and note repository behavior", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });

    try {
      await backend.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );

      const created = await backend.applications.create(
        createJobApplicationSchema.parse({
          url: "https://jobs.example.com/turso",
          title: "Engineer",
          company: "Acme",
          appliedAt: "2026-06-01",
          status: "applied",
        }),
      );
      const note = await backend.notes.create(created.id, "Follow up.");
      const analytics = await backend.analytics.loadSnapshot({
        from: "2026-06-01",
        to: "2026-06-01",
        companies: ["Acme"],
        statuses: ["applied"],
        includeArchived: true,
      });
      expect(analytics).toMatchObject({
        allTimeApplicationCount: 1,
        applications: [{ id: created.id, company: "Acme", status: "applied" }],
      });

      const updated = await backend.applications.update(created.id, { status: "interviewing" });

      expect(updated?.status).toBe("interviewing");
      expect(await backend.notes.listByApplicationId(created.id)).toEqual([note]);
      expect((await backend.exportJson()).applications).toHaveLength(1);

      const deleted = await backend.applications.delete(created.id);
      expect(deleted).toBe(true);
      expect(await backend.applications.list()).toHaveLength(0);
    } finally {
      await backend.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );
      backend.reset();
    }
  });

  test("loginThrottle counts failures in fixed windows and clears keys", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });
    const key = `test:${crypto.randomUUID()}`;

    try {
      await backend.loginThrottle.recordFailure(key, 1_000, 0);
      await backend.loginThrottle.recordFailure(key, 2_000, 0);
      expect(await backend.loginThrottle.get(key)).toEqual({ failures: 2, windowStartedAt: 1_000 });

      await backend.loginThrottle.recordFailure(key, 5_000, 1_000);
      expect(await backend.loginThrottle.get(key)).toEqual({ failures: 1, windowStartedAt: 5_000 });

      await backend.loginThrottle.clear(key);
      expect(await backend.loginThrottle.get(key)).toBeNull();
    } finally {
      await backend.loginThrottle.clear(key);
      backend.reset();
    }
  });

  test("agentApiTokens supports create, validate, and revoke", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });

    try {
      const agentApiTokens = backend.agentApiTokens;
      const created = await agentApiTokens.create("Turso Agent");
      expect(await agentApiTokens.isValidToken(created.token)).toBe(true);
      expect(await agentApiTokens.revoke(created.record.id)).toBe(true);
      expect(await agentApiTokens.hasActiveTokens()).toBe(false);
    } finally {
      backend.reset();
    }
  });

  test("users repository supports password_hash migration and owner credentials", async () => {
    const tursoConfig = requireTursoTestConfig();
    const backend = new TursoDatabaseBackend({
      provider: "turso",
      url: tursoConfig.url,
      authToken: tursoConfig.authToken,
    });

    try {
      expect(await backend.users.hasPasswordLogin()).toBe(false);
      const updated = await backend.users.setOwnerPassword({
        email: "owner@example.com",
        passwordHash: "scrypt$test",
      });
      expect(updated).toBe(true);
      expect(await backend.users.hasPasswordLogin()).toBe(true);
      expect(await backend.users.getCredentialByEmail("owner@example.com")).toMatchObject({
        passwordHash: "scrypt$test",
      });
    } finally {
      backend.reset();
    }
  });
});
