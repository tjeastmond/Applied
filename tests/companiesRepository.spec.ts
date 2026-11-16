import { beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { SqliteCompanyRepository } from "@/lib/server/db/sqliteCompanyRepository";

describe("SqliteCompanyRepository", () => {
  let repository: SqliteCompanyRepository;

  beforeEach(() => {
    repository = new SqliteCompanyRepository(openDatabase(":memory:"));
  });

  test("creates, lists, updates, and toggles ignore status", async () => {
    const created = await repository.create({
      name: "Acme",
      url: "https://acme.example/",
      linkedinUrl: "https://linkedin.com/company/acme",
      email: "hello@acme.example",
    });
    expect(created.name).toBe("Acme");
    expect(created.url).toBe("https://acme.example/");
    expect(created.linkedinUrl).toBe("https://linkedin.com/company/acme");
    expect(created.email).toBe("hello@acme.example");
    expect(created.ignored).toBe(false);

    const listed = await repository.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Acme");

    const updated = await repository.update(created.id, {
      name: "Acme Corp",
      email: "contact@acme.example",
    });
    expect(updated?.name).toBe("Acme Corp");
    expect(updated?.url).toBe("https://acme.example/");
    expect(updated?.email).toBe("contact@acme.example");

    const ignored = await repository.setIgnored(created.id, true);
    expect(ignored?.ignored).toBe(true);

    const activeOnly = await repository.list({ ignored: false });
    expect(activeOnly).toHaveLength(0);

    const ignoredOnly = await repository.list({ ignored: true });
    expect(ignoredOnly).toHaveLength(1);
  });

  test("renaming a company renames matching applications and nothing else", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteCompanyRepository(db);
    const insert = db.prepare(
      `INSERT INTO applications (id, url, company, applied_at, created_at, updated_at)
       VALUES (?, 'https://jobs.example/x', ?, '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    insert.run("a1", "Workable");
    insert.run("a2", " workable ");
    insert.run("a3", "Other Co");
    const company = await repo.create({ name: "Workable" });

    await repo.update(company.id, { email: "hr@workable.example" });
    const companyOf = (id: string) =>
      db.prepare("SELECT company, updated_at FROM applications WHERE id = ?").get(id) as {
        company: string;
        updated_at: string;
      };
    expect(companyOf("a1").company).toBe("Workable");

    await repo.update(company.id, { name: "Seeq" });
    expect(companyOf("a1").company).toBe("Seeq");
    expect(companyOf("a2").company).toBe("Seeq");
    expect(companyOf("a3").company).toBe("Other Co");
    // Rename does not count as activity on the application (stale archive and list order depend on updated_at).
    expect(companyOf("a1").updated_at).toBe("2026-01-01T00:00:00.000Z");
  });

  test("concurrent renames leave applications on the final company name", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteCompanyRepository(db);
    db.prepare(
      `INSERT INTO applications (id, url, company, applied_at, created_at, updated_at)
       VALUES ('a1', 'https://jobs.example/x', 'Acme', '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    const company = await repo.create({ name: "Acme" });

    await Promise.all([repo.update(company.id, { name: "First" }), repo.update(company.id, { name: "Second" })]);

    const finalName = (await repo.getById(company.id))?.name;
    expect(db.prepare("SELECT company FROM applications WHERE id = 'a1'").pluck().get()).toBe(finalName);
  });

  test("rename matches non-ASCII names case-insensitively like the client", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteCompanyRepository(db);
    db.prepare(
      `INSERT INTO applications (id, url, company, applied_at, created_at, updated_at)
       VALUES ('a1', 'https://jobs.example/x', 'école', '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    const company = await repo.create({ name: "École" });

    await repo.update(company.id, { name: "New Name" });

    expect(db.prepare("SELECT company FROM applications WHERE id = 'a1'").pluck().get()).toBe("New Name");
  });

  test("rejects non-ASCII case-variant duplicates", async () => {
    await repository.create({ name: "École" });
    await expect(repository.create({ name: "école" })).rejects.toThrow("Company name already exists");
  });

  test("rename leaves applications that also match another legacy near-duplicate company", async () => {
    const db = openDatabase(":memory:");
    const repo = new SqliteCompanyRepository(db);
    const insertCompany = db.prepare(
      `INSERT INTO companies (id, name, ignored, created_at, updated_at) VALUES (?, ?, 0, '2026-01-01', '2026-01-01')`,
    );
    // Legacy rows the ASCII-only unique index allowed.
    insertCompany.run("c1", "École");
    insertCompany.run("c2", "école");
    db.prepare(
      `INSERT INTO applications (id, url, company, applied_at, created_at, updated_at)
       VALUES ('a1', 'https://jobs.example/x', 'école', '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();

    await repo.update("c1", { name: "Renamed" });

    expect(db.prepare("SELECT company FROM applications WHERE id = 'a1'").pluck().get()).toBe("école");
  });

  test("rejects duplicate names case-insensitively", async () => {
    await repository.create({ name: "Globex" });
    await expect(repository.create({ name: " globex " })).rejects.toThrow("Company name already exists");
  });

  test("findByNormalizedName matches trimmed case-insensitive names", async () => {
    const created = await repository.create({ name: "Initech" });
    const found = await repository.findByNormalizedName("initech");
    expect(found?.id).toBe(created.id);
  });
});
