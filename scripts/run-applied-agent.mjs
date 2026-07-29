#!/usr/bin/env node
/* global process */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureCliBuilt } from "./ensure-cli-built.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliPath = join(root, "bin/applied-agent.js");
const args = process.argv.slice(2);
const jsonMode = args.includes("--json");

ensureCliBuilt({ quiet: jsonMode });

const result = spawnSync(process.execPath, [cliPath, ...args], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
