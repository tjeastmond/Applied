import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Agent CLI keys often live in ~/.zshrc; never replace values already in process.env. */
export const AGENT_CLI_ENV_KEYS = ["AGENT_API_TOKEN", "APPLIED_DEV_URL", "APPLIED_DEV_DIR"] as const;

/** True when the user (shell profile, export, etc.) already set this variable. */
export function isEnvVarSet(env: Record<string, string | undefined>, key: string): boolean {
  return Object.hasOwn(env, key);
}

/** Load KEY=VALUE pairs from a dotenv file without overwriting existing env vars. */
export function loadEnvFile(filePath: string, env: Record<string, string | undefined> = process.env): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key.length === 0 || isEnvVarSet(env, key)) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

export function loadProjectEnvFiles(cwd = process.cwd()): void {
  const projectDir = process.env.APPLIED_DEV_DIR?.trim();
  if (projectDir) {
    loadEnvFile(join(projectDir, ".env.local"));
    loadEnvFile(join(projectDir, ".env"));
  }

  if (projectDir !== cwd) {
    loadEnvFile(join(cwd, ".env.local"));
    loadEnvFile(join(cwd, ".env"));
  }
}
