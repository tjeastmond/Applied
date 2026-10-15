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

  test("run-applied-agent accepts apps as an alias for applications", () => {
    const result = spawnSync(process.execPath, [join(root, "scripts/run-applied-agent.mjs"), "apps", "list"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        AGENT_API_TOKEN: "",
      },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("AGENT_API_TOKEN");
  });

  test("learn prints the learning prompt offline without a token", () => {
    const result = spawnSync(process.execPath, [join(root, "scripts/run-applied-agent.mjs"), "learn"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, AGENT_API_TOKEN: "" },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("# Applied.dev Agent CLI and API Learning Prompt");
    expect(result.stdout).toContain("applied-agent learn");
  });

  test("learn --json wraps the prompt in a markdown field", () => {
    const result = spawnSync(process.execPath, [join(root, "scripts/run-applied-agent.mjs"), "learn", "--json"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, AGENT_API_TOKEN: "" },
    });

    expect(result.status).toBe(0);
    expect((JSON.parse(result.stdout) as { markdown: string }).markdown).toContain("Learning Prompt");
  });
});
