import { readDatabaseConfig } from "@/lib/server/databaseConfig";

export function isDevQuickLoginAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL === "1") {
    return false;
  }

  if (env.NODE_ENV !== "development") {
    return false;
  }

  return readDatabaseConfig(env).provider === "sqlite";
}
