#!/usr/bin/env node
/* global process */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outfile = join(root, "bin/applied-agent.js");
const buildScript = join(root, "scripts/build-cli.mjs");

const sourcePaths = [
  join(root, "scripts/applied-agent.ts"),
  join(root, "scripts/build-cli.mjs"),
  join(root, "src/lib/agentCli"),
  join(root, "src/lib/server/loadEnvFile.ts"),
];

/** @param {string} dir */
function latestMtimeFromDir(dir) {
  let latest = 0;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, latestMtimeFromDir(fullPath));
      continue;
    }

    if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      latest = Math.max(latest, statSync(fullPath).mtimeMs);
    }
  }

  return latest;
}

/** @param {string[]} paths */
function latestSourceMtime(paths) {
  let latest = 0;

  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }

    const stat = statSync(path);
    if (stat.isDirectory()) {
      latest = Math.max(latest, latestMtimeFromDir(path));
    } else {
      latest = Math.max(latest, stat.mtimeMs);
    }
  }

  return latest;
}

function needsBuild() {
  if (!existsSync(outfile)) {
    return true;
  }

  return latestSourceMtime(sourcePaths) > statSync(outfile).mtimeMs;
}

if (needsBuild()) {
  const result = spawnSync(process.execPath, [buildScript], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
