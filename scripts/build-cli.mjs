#!/usr/bin/env node
/* global process */

import * as esbuild from "esbuild";
import { chmodSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcRoot = join(root, "src");
const entryPoint = join(root, "scripts/applied-agent.ts");
const outfile = join(root, "bin/applied-agent.js");

/** @type {import("esbuild").Plugin} */
const pathAliasPlugin = {
  name: "path-alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const withoutAlias = args.path.slice(2);
      const candidates = [
        join(srcRoot, withoutAlias),
        join(srcRoot, `${withoutAlias}.ts`),
        join(srcRoot, `${withoutAlias}.tsx`),
        join(srcRoot, withoutAlias, "index.ts"),
      ];

      for (const candidate of candidates) {
        try {
          if (statSync(candidate).isFile()) {
            return { path: candidate };
          }
        } catch {
          // try next candidate
        }
      }

      return { path: join(srcRoot, withoutAlias) };
    });
  },
};

mkdirSync(dirname(outfile), { recursive: true });

const quiet = process.argv.includes("--quiet");

await esbuild.build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  plugins: [pathAliasPlugin],
  logLevel: quiet ? "silent" : "info",
});

chmodSync(outfile, 0o755);

if (!quiet) {
  process.stderr.write(`Wrote ${relative(root, outfile)}\n`);
}
