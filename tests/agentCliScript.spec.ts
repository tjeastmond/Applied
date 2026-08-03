import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("applied:agent script stdout", () => {
  test("pnpm applied:agent --help keeps stdout free of lifecycle banners", () => {
    const result = spawnSync("pnpm", ["applied:agent", "--help"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.startsWith("Usage:")).toBe(true);
    expect(result.stdout).not.toMatch(/^>\s/m);
  });

  test("run-applied-agent forwards --json output as parseable JSON on stdout", () => {
    const result = spawnSync(process.execPath, [join(root, "scripts/run-applied-agent.mjs"), "docs", "--json"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_API_TOKEN: "",
      },
    });

    expect(result.stdout).not.toMatch(/^>\s/m);

    if (result.status === 2) {
      expect(() => {
        JSON.parse(result.stdout);
      }).toThrow();
      expect(result.stderr).toContain("AGENT_API_TOKEN");
      return;
    }

    expect(() => {
      JSON.parse(result.stdout);
    }).not.toThrow();
  });
});
