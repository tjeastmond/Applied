import { describe, expect, test, vi } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";
import {
  ApplicationConflictError,
  patchApplicationWithSideEffects,
} from "@/lib/server/services/applicationMutationService";
import { requireTursoTestConfig } from "./helpers/tursoTestConfig";

// patchApplicationWithSideEffects resolves its backend from the db singleton; point it at the test backend.
const dbMock = vi.hoisted(() => ({ backend: undefined as unknown as TursoDatabaseBackend }));
vi.mock("@/lib/server/db", () => ({
  getDatabaseBackend: () => dbMock.backend,
  getRepository: () => dbMock.backend.applications,
}));

// Each test makes many network round trips to Turso; the 5s default is too tight.
describe("TursoDatabaseBackend", { timeout: 30_000 }, () => {
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

  test("company update and setIgnored persist", async () => {
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
      const company = await backend.companies.create({ name: "Acme" });

      expect((await backend.companies.update(company.id, { name: "Acme Renamed", email: "hr@acme.test" }))?.name).toBe(
        "Acme Renamed",
      );
      expect(await backend.companies.getById(company.id)).toMatchObject({
        name: "Acme Renamed",
        email: "hr@acme.test",
      });

      expect((await backend.companies.setIgnored(company.id, true))?.ignored).toBe(true);
      expect((await backend.companies.getById(company.id))?.ignored).toBe(true);
    } finally {
      await backend.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );
      backend.reset();
    }
  });

  describe("status change concurrency guard", () => {
    // Bumps updated_at just before the guarded UPDATE's transaction opens, `times` times,
    // simulating another writer landing between the caller's read and the write.
    async function setup(times: number) {
      const tursoConfig = requireTursoTestConfig();
      const backend = new TursoDatabaseBackend({
        provider: "turso",
        url: tursoConfig.url,
        authToken: tursoConfig.authToken,
      });
      dbMock.backend = backend;
      await backend.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );
      const created = await backend.applications.create(
        createJobApplicationSchema.parse({
          url: "https://jobs.example.com/turso-conflict",
          title: "Engineer",
          company: "Acme",
          appliedAt: "2026-06-01",
          status: "applied",
        }),
      );
      const client = backend.getTursoClient();
      const realTransaction = client.transaction.bind(client);
      let remaining = times;
      vi.spyOn(client, "transaction").mockImplementation(async (mode) => {
        if (remaining-- > 0) {
          await client.execute({
            sql: "UPDATE applications SET updated_at = ? WHERE id = ?",
            args: [`2099-01-0${remaining + 1}T00:00:00.000Z`, created.id],
          });
        }
        return realTransaction(mode);
      });
      return { backend, created };
    }

    async function cleanup(backend: TursoDatabaseBackend) {
      vi.restoreAllMocks();
      await backend.importJson(
        { version: 1, exportedAt: new Date().toISOString(), applications: [], notes: [] },
        "replace",
      );
      backend.reset();
    }

    test("throws ApplicationConflictError without history or note when both attempts lose the race", async () => {
      const { backend, created } = await setup(2);
      try {
        await expect(patchApplicationWithSideEffects(created.id, { status: "interviewing" }, created)).rejects.toThrow(
          ApplicationConflictError,
        );

        const fresh = await backend.applications.getById(created.id);
        expect(fresh?.status).toBe("applied");
        expect(await backend.notes.listByApplicationId(created.id)).toHaveLength(0);
        const history = await backend.statusHistory.listByApplicationId(created.id);
        expect(history.map((entry) => entry.toStatus)).toEqual(["applied"]);
      } finally {
        await cleanup(backend);
      }
    });

    test("retry absorbs a single concurrent change", async () => {
      const { backend, created } = await setup(1);
      try {
        const result = await patchApplicationWithSideEffects(created.id, { status: "interviewing" }, created);
        expect(result?.status).toBe("interviewing");
        expect((await backend.applications.getById(created.id))?.status).toBe("interviewing");

        const history = await backend.statusHistory.listByApplicationId(created.id);
        expect(history.map((entry) => entry.toStatus).sort()).toEqual(["applied", "interviewing"]);
        expect(await backend.notes.listByApplicationId(created.id)).toHaveLength(1);
      } finally {
        await cleanup(backend);
      }
    });
  });
});
