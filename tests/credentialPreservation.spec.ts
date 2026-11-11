import { describe, expect, test } from "vitest";
import { splitSqlStatements, withCredentialPreservation } from "@/lib/server/services/backupService";

const wrap = (...body: string[]) => ["BEGIN;", ...body, "COMMIT;"].join("\n");
const run = (sql: string) => splitSqlStatements(withCredentialPreservation(sql));

describe("withCredentialPreservation", () => {
  test("snapshots right after BEGIN and restores right before COMMIT", () => {
    const out = run(wrap("DELETE FROM users;", "INSERT INTO users (id) VALUES ('a');"));
    expect(out[0]).toMatch(/^BEGIN/i);
    expect(out[1]).toMatch(/^CREATE TEMP TABLE kept_credentials/);
    expect(out.at(-1)).toMatch(/^COMMIT/i);
    expect(out.at(-2)).toBe("DROP TABLE kept_credentials");
    expect(out.at(-3)).toMatch(/^UPDATE users SET email/);
    expect(out.at(-4)).toMatch(/^ALTER TABLE users ADD COLUMN password_hash/);
  });

  test("throws without BEGIN or COMMIT", () => {
    expect(() => withCredentialPreservation("DELETE FROM users;")).toThrow(/BEGIN and COMMIT/);
    expect(() => withCredentialPreservation("BEGIN;\nDELETE FROM users;")).toThrow(/BEGIN and COMMIT/);
  });

  test("is not fooled by semicolons or COMMIT inside string literals", () => {
    const out = run(wrap("INSERT INTO application_notes (id, content) VALUES ('n', 'a; COMMIT; b');"));
    expect(out.filter((s) => /^COMMIT$/i.test(s))).toHaveLength(1);
    expect(out.at(-1)).toMatch(/^COMMIT/i);
    expect(out.findIndex((s) => s.startsWith("INSERT"))).toBeLessThan(
      out.findIndex((s) => s.startsWith("ALTER TABLE")),
    );
    expect(out.find((s) => s.startsWith("INSERT"))).toContain("'a; COMMIT; b'");
  });
});
