import { join } from "node:path";
import { z } from "zod";

export const databaseProviderSchema = z.enum(["sqlite", "turso"]);

export type DatabaseProvider = z.infer<typeof databaseProviderSchema>;

export type SqliteDatabaseConfig = {
  provider: "sqlite";
  path: string;
};

export type TursoDatabaseConfig = {
  provider: "turso";
  url: string;
  authToken: string;
};

export type DatabaseConfig = SqliteDatabaseConfig | TursoDatabaseConfig;
export type DatabaseEnv = Record<string, string | undefined>;

const rawEnvSchema = z.object({
  DATABASE_PROVIDER: z.string().optional(),
  DATABASE_PATH: z.string().optional(),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  VERCEL: z.string().optional(),
});

export function getDefaultDatabasePath(): string {
  return join(process.cwd(), "data", "applied.db");
}

export function readDatabaseConfig(env: DatabaseEnv = process.env): DatabaseConfig {
  const parsed = rawEnvSchema.parse(env);
  const providerRaw = parsed.DATABASE_PROVIDER ?? "sqlite";
  const provider = databaseProviderSchema.safeParse(providerRaw);

  if (!provider.success) {
    throw new Error("DATABASE_PROVIDER must be sqlite or turso");
  }

  if (provider.data === "sqlite") {
    if (parsed.VERCEL === "1") {
      throw new Error("DATABASE_PROVIDER=sqlite is not supported on Vercel; use DATABASE_PROVIDER=turso");
    }

    return {
      provider: "sqlite",
      path: parsed.DATABASE_PATH ?? getDefaultDatabasePath(),
    };
  }

  if (!parsed.TURSO_DATABASE_URL || parsed.TURSO_DATABASE_URL.trim().length === 0) {
    throw new Error("TURSO_DATABASE_URL is required when DATABASE_PROVIDER=turso");
  }

  if (!parsed.TURSO_AUTH_TOKEN || parsed.TURSO_AUTH_TOKEN.trim().length === 0) {
    throw new Error("TURSO_AUTH_TOKEN is required when DATABASE_PROVIDER=turso");
  }

  return {
    provider: "turso",
    url: parsed.TURSO_DATABASE_URL.trim(),
    authToken: parsed.TURSO_AUTH_TOKEN.trim(),
  };
}
