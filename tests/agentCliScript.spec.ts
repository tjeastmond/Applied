import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { AGENT_CLI_COMMAND_SPECS } from "@/lib/agentCli/commandSpecs";
import { AGENT_CLI_COMMANDS } from "@/lib/server/agentDiscovery";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const runner = join(root, "scripts/run-applied-agent.mjs");

describe("applied:agent script stdout", () => {
  beforeAll(() => {
    // Build once up front so a stale bin/ is not rebuilt inside a timed test.
    const build = spawnSync(process.execPath, [join(root, "scripts/ensure-cli-built.mjs")], { cwd: root });
    expect(build.status).toBe(0);
  }, 60_000);

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

  test("learn and docs reject unknown arguments", () => {
    for (const args of [
      ["learn", "--jsno"],
      ["learn", "foo"],
      ["docs", "bar"],
    ]) {
      const result = spawnSync(process.execPath, [runner, ...args], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, AGENT_API_TOKEN: "" },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unknown option");
    }
  });

  test("learn exits cleanly when the reader closes the pipe early", () => {
    const result = spawnSync("bash", ["-c", `node "${runner}" learn | head -n 1; echo "status=\${PIPESTATUS[0]}"`], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, AGENT_API_TOKEN: "" },
    });

    expect(result.stdout).toContain("# Applied.dev Agent CLI and API Learning Prompt");
    expect(result.stdout, result.stderr).toContain("status=0");
    expect(result.stderr).not.toContain("EPIPE");
  });
});

describe("agent CLI command lists stay in sync", () => {
  const wrapper = readFileSync(join(root, "scripts/applied"), "utf8");
  const learningPrompt = readFileSync(join(root, "LEARNING_PROMPT.md"), "utf8");

  test.each(AGENT_CLI_COMMAND_SPECS.map((spec) => spec.usage))("%s appears in every command list", (usage) => {
    expect(wrapper).toContain(`  ${usage}`);
    expect(learningPrompt).toContain(`applied-agent ${usage}`);
    expect(AGENT_CLI_COMMANDS).toContain(`pnpm applied:agent ${usage}`);
  });

  test("CLI --help prints every spec", () => {
    const result = spawnSync(process.execPath, [runner, "--help"], { cwd: root, encoding: "utf8" });
    for (const spec of AGENT_CLI_COMMAND_SPECS) {
      expect(result.stdout).toContain(`applied ${spec.usage}`);
    }
  });

  test("applied wrapper help lists learn and the companies write commands", () => {
    const result = spawnSync("bash", [join(root, "scripts/applied"), "--help"], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("learn [--json]");
    expect(result.stdout).toContain("companies unignore --id ID");
  });

  test("applied wrapper falls back to the global shim only when esbuild is not installed", () => {
    expect(wrapper).toMatch(/node_modules\/esbuild[\s\S]*exec node "\$runner"[\s\S]*exec applied-agent/);
  });
});
