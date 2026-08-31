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
