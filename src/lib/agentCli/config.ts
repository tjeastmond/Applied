import { loadProjectEnvFiles } from "@/lib/server/loadEnvFile";

export type AgentCliConfig = {
  baseUrl: string;
  token: string;
};

export class AgentCliConfigError extends Error {
  readonly exitCode = 2;
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export function resolveAgentCliConfig(
  options: { tokenOverride?: string; baseUrlOverride?: string } = {},
): AgentCliConfig {
  loadProjectEnvFiles();

  const token = options.tokenOverride?.trim() || process.env.AGENT_API_TOKEN?.trim();
  if (!token) {
    throw new AgentCliConfigError(
      "AGENT_API_TOKEN is required. Export it in your shell (e.g. ~/.zshrc), set it in .env.local, pass --token, or run pnpm agent:token for a local bootstrap value.",
    );
  }

  const port = process.env.PORT?.trim() || "3030";
  const baseUrl = normalizeBaseUrl(
    options.baseUrlOverride?.trim() || process.env.APPLIED_DEV_URL?.trim() || `http://localhost:${port}`,
  );

  return { baseUrl, token };
}

export function normalizeAgentStatus(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "apply") {
    return "to_apply";
  }
  return normalized;
}
